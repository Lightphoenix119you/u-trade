import { useEffect, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { CampusProvider, useCampus } from '@/context/CampusContext';
import { CreateListingModalProvider } from '@/context/CreateListingModalContext';
import { OnboardingProvider } from '@/context/OnboardingContext';
import { OnboardingTour } from '@/components/OnboardingTour';
import { MeshBackground } from '@/components/MeshBackground';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { useHashRoute, parseRoute } from '@/lib/router';
import { campusThemeVars } from '@/lib/format';

import { Home } from '@/pages/Home';
import { Marketplace } from '@/pages/Marketplace';
import { ListingDetail } from '@/pages/ListingDetail';
import { AuthPage } from '@/pages/AuthPage';
import { Sell } from '@/pages/Sell';
import { OrderDetail } from '@/pages/OrderDetail';
import { Messages } from '@/pages/Messages';
import { ProfilePage } from '@/pages/ProfilePage';
import { AdminPage } from '@/pages/AdminPage';
import { ShopsPage } from '@/pages/ShopsPage';
import { AboutPage } from '@/pages/AboutPage';
import { MeetingPointsPage } from '@/pages/MeetingPointsPage';
import { RequestCampusPage } from '@/pages/RequestCampusPage';
import { MyShopPage } from '@/pages/MyShopPage';
import { SellerProfilePage } from '@/pages/SellerProfilePage';

type FlashMessage = { type: 'error' | 'success' | 'info'; message: string };

function AppContent() {
  const [route, navigate] = useHashRoute();
  const { selectedCampus } = useCampus();
  const { loading: authLoading } = useAuth();
  const [flash, setFlash] = useState<FlashMessage | null>(null);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 5000);
    return () => clearTimeout(timer);
  }, [flash]);

  // Apply campus theme CSS variables to document root
  useEffect(() => {
    const vars = campusThemeVars(selectedCampus);
    const root = document.documentElement;
    Object.entries(vars).forEach(([key, value]) => root.style.setProperty(key, value));
  }, [selectedCampus]);

  const { segments } = parseRoute(route);
  const page = segments[0] || '';
  const param = segments[1];

  const renderPage = () => {
    if (authLoading) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="skeleton h-12 w-12 rounded-full" />
        </div>
      );
    }

    switch (page) {
      case '':
        return <Home navigate={navigate} />;
      case 'market':
        return <Marketplace navigate={navigate} />;
      case 'listing':
        return param ? <ListingDetail listingId={param} navigate={navigate} /> : <Marketplace navigate={navigate} />;
      case 'shops':
        return <ShopsPage navigate={navigate} />;
      case 'about':
        return <AboutPage navigate={navigate} />;
      case 'meeting-points':
        return <MeetingPointsPage navigate={navigate} />;
      case 'signin':
        return <AuthPage mode="signin" navigate={navigate} />;
      case 'signup':
        return <AuthPage mode="signup" navigate={navigate} />;
      case 'sell':
        return <Sell navigate={navigate} />;
      case 'orders':
        return param ? <OrderDetail orderId={param} navigate={navigate} /> : <ProfilePage navigate={navigate} />;
      case 'messages': {
        const url = new URL(`http://x/${route}`);
        const to = url.searchParams.get('to') || undefined;
        const listing = url.searchParams.get('listing') || undefined;
        return <Messages navigate={navigate} initialRecipient={to} initialListing={listing} />;
      }
      case 'profile':
        return <ProfilePage navigate={navigate} />;
      case 'admin':
        return <AdminPage navigate={navigate} setFlash={setFlash} />;
      case 'request-campus':
        return <RequestCampusPage navigate={navigate} />;
      case 'my-shop':
        return <MyShopPage navigate={navigate} />;
      case 'seller':
        return param ? <SellerProfilePage sellerId={param} navigate={navigate} /> : <Marketplace navigate={navigate} />;
      default:
        return (
          <div className="relative z-10 mx-auto max-w-md px-4 py-16 text-center">
            <h1 className="text-4xl font-black campus-gradient-text">404</h1>
            <p className="mt-2 text-sm text-white/40">Page introuvable</p>
            <button onClick={() => navigate('/')} className="campus-text mt-3 text-sm hover:underline">
              Retour à l'accueil
            </button>
          </div>
        );
    }
  };

  // Auth pages have no header
  const isAuthPage = page === 'signin' || page === 'signup';

  return (
    <CreateListingModalProvider navigate={navigate}>
      <OnboardingProvider>
      <MeshBackground campus={selectedCampus} />
      {flash && (
        <div className="fixed left-1/2 top-20 z-50 -translate-x-1/2 animate-fade-up px-4">
          <div
            className={`glass-strong flex items-center gap-3 rounded-xl border px-4 py-3 shadow-2xl ${
              flash.type === 'error'
                ? 'border-red-500/40'
                : flash.type === 'success'
                  ? 'border-emerald-500/40'
                  : 'border-white/20'
            }`}
          >
            <AlertCircle
              className={`h-5 w-5 flex-shrink-0 ${
                flash.type === 'error'
                  ? 'text-red-400'
                  : flash.type === 'success'
                    ? 'text-emerald-400'
                    : 'text-white/60'
              }`}
            />
            <span className="text-sm font-medium">{flash.message}</span>
            <button onClick={() => setFlash(null)} className="ml-2 text-white/40 transition hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      <div className="relative min-h-screen w-full max-w-full overflow-x-hidden">
        {!isAuthPage && <Header route={route} navigate={navigate} />}
        <main>{renderPage()}</main>
        {!isAuthPage && <Footer navigate={navigate} />}
      </div>
      {!isAuthPage && <OnboardingTour />}
      </OnboardingProvider>
    </CreateListingModalProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <CampusProvider>
        <AppContent />
      </CampusProvider>
    </AuthProvider>
  );
}

export default App;
