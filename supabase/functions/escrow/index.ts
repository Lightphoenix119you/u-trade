import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Simple hash for OTP code (not crypto-grade — the OTP itself is the secret)
async function hashCode(code: string): Promise<string> {
  const data = new TextEncoder().encode(`utrade-escrow-${code}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function genOtp(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

interface OrderRow {
  id: string;
  buyer_id: string;
  seller_id: string;
  listing_id: string;
  status: string;
  price_usd: number;
  commission_rate: number;
  commission_usd: number;
  seller_payout_usd: number;
  escrow_code: string | null;
  escrow_code_hash: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Extract the user's JWT from the Authorization header to identify the caller
    const authHeader = req.headers.get("Authorization") || "";
    const userToken = authHeader.replace("Bearer ", "");

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });

    // Identify the caller
    const { data: userData, error: userErr } = await userClient.auth.getUser(userToken);
    if (userErr || !userData.user) {
      return jsonResponse({ error: "Non authentifié" }, 401);
    }
    const callerId = userData.user.id;

    const body = await req.json();
    const action: string = body.action;

    // ==========================================================
    // ACTION: confirm_payment — locks funds, generates OTP
    // Called by the buyer after completing Mobile Money payment.
    // ==========================================================
    if (action === "confirm_payment") {
      const orderId: string = body.order_id;
      if (!orderId) return jsonResponse({ error: "order_id requis" }, 400);

      // Verify caller is the buyer
      const { data: order } = await adminClient
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .maybeSingle() as { data: OrderRow | null; error: unknown };

      if (!order) return jsonResponse({ error: "Commande introuvable" }, 404);
      if (order.buyer_id !== callerId) return jsonResponse({ error: "Non autorisé" }, 403);
      if (order.status !== "pending_payment") return jsonResponse({ error: "Commande déjà payée" }, 400);

      // Generate OTP
      const otp = genOtp();
      const otpHash = await hashCode(otp);

      // Update order to 'paid' with escrow code (buyer-readable) + hash (seller verification)
      const { error: updateErr } = await adminClient
        .from("orders")
        .update({
          status: "paid",
          escrow_code: otp,
          escrow_code_hash: otpHash,
          paid_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      if (updateErr) return jsonResponse({ error: "Erreur mise à jour" }, 500);

      // Record escrow lock transaction
      await adminClient.from("transactions").insert({
        order_id: orderId,
        user_id: order.seller_id,
        type: "escrow_lock",
        amount_usd: order.price_usd,
        description: `Fonds bloqués pour commande ${orderId.slice(0, 8)}`,
        created_by: callerId,
      });

      // Send system message to seller
      await adminClient.from("messages").insert({
        conversation_id: orderId,
        sender_id: callerId,
        recipient_id: order.seller_id,
        order_id: orderId,
        content: "Paiement confirmé. L'argent est bloqué par la plateforme. Présentez-vous au point de rendez-vous.",
        is_system: true,
      });

      return jsonResponse({ success: true, otp, message: "Paiement confirmé. Code OTP généré." });
    }

    // ==========================================================
    // ACTION: verify_otp — seller enters the buyer's OTP code
    // If correct, release funds to seller + mark order completed.
    // ==========================================================
    if (action === "verify_otp") {
      const orderId: string = body.order_id;
      const code: string = body.code;
      if (!orderId || !code) return jsonResponse({ error: "order_id et code requis" }, 400);
      if (!/^\d{6}$/.test(code)) return jsonResponse({ error: "Code: 6 chiffres" }, 400);

      const { data: order } = await adminClient
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .maybeSingle() as { data: OrderRow | null; error: unknown };

      if (!order) return jsonResponse({ error: "Commande introuvable" }, 404);
      if (order.seller_id !== callerId) return jsonResponse({ error: "Seul le vendeur peut valider le code" }, 403);
      if (order.status !== "paid" && order.status !== "in_delivery") {
        return jsonResponse({ error: "Commande non éligible" }, 400);
      }

      // Verify OTP
      const inputHash = await hashCode(code);
      if (!order.escrow_code_hash || inputHash !== order.escrow_code_hash) {
        return jsonResponse({ error: "Code OTP incorrect" }, 400);
      }

      // Release funds
      const { error: releaseErr } = await adminClient
        .from("orders")
        .update({
          status: "completed",
          escrow_revealed_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      if (releaseErr) return jsonResponse({ error: "Erreur déblocage" }, 500);

      // Comble un manque : sans ça, l'annonce restait "active" indéfiniment
      // même après une vente conclue par ce chemin (cohérent avec la RPC
      // validate_order_otp, qui le fait déjà de son côté).
      await adminClient
        .from("listings")
        .update({ status: "sold" })
        .eq("id", order.listing_id);

      // Record commission + payout transactions
      await adminClient.from("transactions").insert([
        {
          order_id: orderId,
          user_id: order.seller_id,
          type: "commission",
          amount_usd: order.commission_usd,
          description: `Commission plateforme (${(order.commission_rate * 100).toFixed(0)}%)`,
          created_by: callerId,
        },
        {
          order_id: orderId,
          user_id: order.seller_id,
          type: "payout",
          amount_usd: order.seller_payout_usd,
          description: `Versement vendeur (solde net)`,
          created_by: callerId,
        },
      ]);

      // Increment seller sales count
      await adminClient.rpc("increment_seller_sales", { seller_id: order.seller_id }).catch(() => {});

      // System message
      await adminClient.from("messages").insert({
        conversation_id: orderId,
        sender_id: callerId,
        recipient_id: order.buyer_id,
        order_id: orderId,
        content: "Transaction complétée. Le vendeur a reçu son paiement.",
        is_system: true,
      });

      return jsonResponse({ success: true, message: "Paiement débloqué au vendeur !" });
    }

    // ==========================================================
    // ACTION: dispute — buyer or seller reports a problem at delivery
    // ==========================================================
    if (action === "dispute") {
      const orderId: string = body.order_id;
      const reason: string = body.reason;
      if (!orderId || !reason) return jsonResponse({ error: "order_id et reason requis" }, 400);

      const { data: order } = await adminClient
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .maybeSingle() as { data: OrderRow | null; error: unknown };

      if (!order) return jsonResponse({ error: "Commande introuvable" }, 404);
      if (order.buyer_id !== callerId && order.seller_id !== callerId) {
        return jsonResponse({ error: "Non autorisé" }, 403);
      }
      if (!["paid", "in_delivery", "delivered"].includes(order.status)) {
        return jsonResponse({ error: "Commande non éligible pour litige" }, 400);
      }

      await adminClient
        .from("orders")
        .update({
          status: "disputed",
          disputed_at: new Date().toISOString(),
          dispute_reason: reason,
        })
        .eq("id", orderId);

      // Notify both parties
      const otherId = callerId === order.buyer_id ? order.seller_id : order.buyer_id;
      await adminClient.from("messages").insert({
        conversation_id: orderId,
        sender_id: callerId,
        recipient_id: otherId,
        order_id: orderId,
        content: `Litige ouvert : ${reason}. L'équipe U. Trade va examiner la situation.`,
        is_system: true,
      });

      return jsonResponse({ success: true, message: "Litige ouvert. L'administrateur a été notifié." });
    }

    // ==========================================================
    // ACTION: reveal_otp — buyer re-retrieves their own OTP code
    // Only the buyer of a paid/in_delivery order can call this.
    // ==========================================================
    if (action === "reveal_otp") {
      const orderId: string = body.order_id;
      if (!orderId) return jsonResponse({ error: "order_id requis" }, 400);

      const { data: order } = await adminClient
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .maybeSingle() as { data: OrderRow | null; error: unknown };

      if (!order) return jsonResponse({ error: "Commande introuvable" }, 404);
      if (order.buyer_id !== callerId) return jsonResponse({ error: "Non autorisé" }, 403);
      if (!["paid", "in_delivery"].includes(order.status)) {
        return jsonResponse({ error: "Aucun code actif pour cette commande" }, 400);
      }
      if (!order.escrow_code) return jsonResponse({ error: "Code indisponible" }, 404 );

      return jsonResponse({ success: true, otp: order.escrow_code });
    }

    return jsonResponse({ error: "Action inconnue" }, 400);
  } catch (err) {
    return jsonResponse({ error: err.message || "Erreur serveur" }, 500);
  }
});
