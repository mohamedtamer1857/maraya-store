/// <reference types="google.maps" />
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {
  AdvancedMarker,
  APIProvider,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useApiLoadingStatus,
  APILoadingStatus,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import type { MapMouseEvent } from '@vis.gl/react-google-maps';
import { Loader2, LocateFixed, MapPin, Navigation, Search, Star } from 'lucide-react';
import type { Language } from '../types';

interface PlaceLocationItem {
  id: string;
  name: string;
  address: string;
  position: google.maps.LatLngLiteral;
  rating?: number;
  googleMapsURI?: string;
}

interface AtelierLocationsMapProps {
  lang: Language;
  apiKey: string;
  onSelectDeliveryAddress: (address: string) => void;
  compact?: boolean;
  isPickingForCheckout?: boolean;
  onConfirmCheckoutLocation?: () => void;
}

const DEFAULT_CENTER: google.maps.LatLngLiteral = { lat: 30.0444, lng: 31.2357 };
const EGYPT_BOUNDS: google.maps.LatLngBoundsLiteral = {
  north: 31.92,
  south: 21.99,
  east: 36.9,
  west: 24.7,
};

function PlacePin({
  place,
  selected,
  onSelect,
}: {
  place: PlaceLocationItem;
  selected: boolean;
  onSelect: (place: PlaceLocationItem) => void;
}) {
  const [markerRef, marker] = useAdvancedMarkerRef();

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={place.position}
        title={place.name}
        onClick={() => onSelect(place)}
      >
        <Pin
          background={selected ? '#1D4ED8' : '#0F1115'}
          borderColor={selected ? '#93C5FD' : '#374151'}
          glyphColor="#FFFFFF"
          scale={selected ? 1.2 : 1.0}
        />
      </AdvancedMarker>

      {selected && marker && (
        <InfoWindow anchor={marker} maxWidth={260} onCloseClick={() => onSelect(place)}>
          <div className="p-1 text-start text-[#0F1115] space-y-1">
            <p className="font-semibold text-xs leading-snug">{place.name}</p>
            <p className="text-[11px] text-[#525866]">{place.address}</p>
            {typeof place.rating === 'number' && (
              <p className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600">
                <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                <span>{place.rating.toFixed(1)}</span>
              </p>
            )}
            {place.googleMapsURI && (
              <div>
                <a
                  href={place.googleMapsURI}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-semibold text-[#1D4ED8] underline"
                >
                  Google Maps
                </a>
              </div>
            )}
          </div>
        </InfoWindow>
      )}
    </>
  );
}

function MapWorkspace({
  lang,
  onSelectDeliveryAddress,
  compact = false,
  isPickingForCheckout,
  onConfirmCheckoutLocation,
}: {
  lang: Language;
  onSelectDeliveryAddress: (address: string) => void;
  compact?: boolean;
  isPickingForCheckout?: boolean;
  onConfirmCheckoutLocation?: () => void;
}) {
  const map = useMap();
  const placesLib = useMapsLibrary('places');
  const routesLib = useMapsLibrary('routes');
  const loadingStatus = useApiLoadingStatus();

  const [places, setPlaces] = useState<PlaceLocationItem[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<PlaceLocationItem | null>(null);
  const [destinationPlace, setDestinationPlace] = useState<PlaceLocationItem | null>(null);
  const [queryText, setQueryText] = useState('');
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [routeSummary, setRouteSummary] = useState<{
    distanceKm: string;
    durationMin: number;
  } | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  const handleQuotaCheck = useCallback((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    if (
      msg.includes('RESOURCE_EXHAUSTED') ||
      msg.includes('OVER_QUERY_LIMIT') ||
      msg.includes('429') ||
      msg.includes('Quota')
    ) {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    }
  }, []);

  // Load real fashion boutiques / retail landmarks from Google Places API (New)
  useEffect(() => {
    if (!placesLib) return;

    let cancelled = false;
    const loadPlaces = async () => {
      try {
        const res = await placesLib.Place.searchByText({
          textQuery:
            lang === 'ar' ? 'بوتيك أزياء القاهرة مصر' : 'luxury fashion boutique Cairo Egypt',
          fields: ['displayName', 'formattedAddress', 'location', 'rating', 'googleMapsURI'],
          region: 'EG',
          locationRestriction: EGYPT_BOUNDS,
          maxResultCount: 5,
        });
        if (cancelled) return;

        const mapped: PlaceLocationItem[] = (res.places ?? [])
          .filter((p) => p.location)
          .map((p, idx) => ({
            id: p.id || `place-${idx}`,
            name: p.displayName || (lang === 'ar' ? 'فرع أزياء' : 'Fashion Location'),
            address: p.formattedAddress || '',
            position: {
              lat: p.location!.lat(),
              lng: p.location!.lng(),
            },
            rating: typeof p.rating === 'number' ? p.rating : undefined,
            googleMapsURI: p.googleMapsURI ?? undefined,
          }));

        setPlaces(mapped);
        if (mapped[0]) {
          setSelectedPlace(mapped[0]);
          map?.panTo(mapped[0].position);
        }
      } catch (err) {
        handleQuotaCheck(err);
        if (!cancelled) {
          setMapError(
            lang === 'ar'
              ? 'مش قادرين نحمّل الفروع على خرائط جوجل دلوقتي.'
              : 'Unable to load Egypt locations from Google Maps.'
          );
        }
      }
    };

    void loadPlaces();
    return () => {
      cancelled = true;
    };
  }, [placesLib, lang, map, handleQuotaCheck]);

  // Modern AutocompleteSuggestion with session tokens
  useEffect(() => {
    if (!placesLib || !queryText.trim()) {
      setSuggestions([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new placesLib.AutocompleteSessionToken();
        }
        const res = await placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: queryText.trim(),
          includedRegionCodes: ['eg'],
          region: 'eg',
          sessionToken: sessionTokenRef.current,
        });
        setSuggestions(res.suggestions ?? []);
      } catch (err) {
        handleQuotaCheck(err);
      }
    }, 240);

    return () => window.clearTimeout(timer);
  }, [placesLib, queryText, handleQuotaCheck]);

  const handleSelectSuggestion = async (suggestion: google.maps.places.AutocompleteSuggestion) => {
    if (!placesLib || !suggestion.placePrediction) return;
    setIsSearching(true);
    setMapError(null);
    try {
      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'location', 'viewport', 'googleMapsURI'],
      });
      if (place.location) {
        const picked: PlaceLocationItem = {
          id: place.id || `picked-${Date.now()}`,
          name: place.displayName || suggestion.placePrediction.text.text,
          address: place.formattedAddress || suggestion.placePrediction.text.text,
          position: {
            lat: place.location.lat(),
            lng: place.location.lng(),
          },
          googleMapsURI: place.googleMapsURI ?? undefined,
        };
        setDestinationPlace(picked);
        setQueryText(picked.address);
        setSuggestions([]);
        onSelectDeliveryAddress(picked.address);
        if (place.viewport && map) {
          map.fitBounds(place.viewport);
        } else {
          map?.panTo(picked.position);
        }
      }
      sessionTokenRef.current = null;
    } catch (err) {
      handleQuotaCheck(err);
      setMapError(
        lang === 'ar'
          ? 'مش قادرين نجيب تفاصيل العنوان ده.'
          : 'Unable to fetch details for the selected address.'
      );
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!placesLib || !queryText.trim()) return;
    setIsSearching(true);
    setMapError(null);
    try {
      const res = await placesLib.Place.searchByText({
        textQuery: queryText.trim(),
        fields: ['displayName', 'formattedAddress', 'location', 'rating', 'googleMapsURI'],
        region: 'EG',
        locationRestriction: EGYPT_BOUNDS,
        maxResultCount: 3,
      });
      const first = res.places?.[0];
      if (first?.location) {
        const picked: PlaceLocationItem = {
          id: first.id || `search-${Date.now()}`,
          name: first.displayName || queryText.trim(),
          address: first.formattedAddress || queryText.trim(),
          position: {
            lat: first.location.lat(),
            lng: first.location.lng(),
          },
          rating: typeof first.rating === 'number' ? first.rating : undefined,
          googleMapsURI: first.googleMapsURI ?? undefined,
        };
        setDestinationPlace(picked);
        setSuggestions([]);
        onSelectDeliveryAddress(picked.address);
        map?.panTo(picked.position);
        map?.setZoom(14);
      } else {
        setMapError(
          lang === 'ar'
            ? 'ملقيناش العنوان ده جوه مصر، جرب تكتب اسم المنطقة أو الشارع أوضح.'
            : 'No matching address found within Egypt.'
        );
      }
    } catch (err) {
      handleQuotaCheck(err);
    } finally {
      setIsSearching(false);
    }
  };

  const applyCoordinatesToMap = useCallback(
    async (lat: number, lng: number, labelPrefix?: string) => {
      setIsLocating(true);
      setMapError(null);
      try {
        const res = await fetch(
          `/api/maps/reverse-geocode?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&lang=${lang}`
        );
        if (res.status === 429) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        const data = (await res.json()) as { address?: string };
        const resolvedAddress =
          data.address ||
          `${labelPrefix ? `${labelPrefix} ` : ''}(${lat.toFixed(5)}, ${lng.toFixed(5)})`;

        const picked: PlaceLocationItem = {
          id: `pin-${Date.now()}`,
          name:
            lang === 'ar' ? 'موقع التوصيل المختار' : 'Selected Delivery Location',
          address: resolvedAddress,
          position: { lat, lng },
        };
        setDestinationPlace(picked);
        setQueryText(resolvedAddress);
        setSuggestions([]);
        onSelectDeliveryAddress(resolvedAddress);
        map?.panTo({ lat, lng });
        if ((map?.getZoom() ?? 0) < 14) {
          map?.setZoom(14);
        }
      } catch {
        const fallback = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        setDestinationPlace({
          id: `pin-${Date.now()}`,
          name: lang === 'ar' ? 'موقع التوصيل المختار' : 'Selected Delivery Location',
          address: fallback,
          position: { lat, lng },
        });
        setQueryText(fallback);
        onSelectDeliveryAddress(fallback);
      } finally {
        setIsLocating(false);
      }
    },
    [lang, map, onSelectDeliveryAddress]
  );

  const handleUseCurrentGps = () => {
    if (!navigator.geolocation) {
      setMapError(
        lang === 'ar'
          ? 'المتصفح مش بيدعم تحديد الموقع تلقائياً.'
          : 'Browser geolocation is not supported.'
      );
      return;
    }
    setIsLocating(true);
    setMapError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void applyCoordinatesToMap(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        setIsLocating(false);
        setMapError(
          lang === 'ar'
            ? 'مقدرناش نوصل لموقعك الحالي. اسمح باللوكيشن أو اضغط على الخريطة.'
            : 'Unable to access your current location. Allow GPS or click on the map.'
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const handleMapClick = (event: MapMouseEvent) => {
    const latLng = event.detail?.latLng;
    if (!latLng) return;
    void applyCoordinatesToMap(latLng.lat, latLng.lng);
  };

  // Modern Route.computeRoutes between selected store and delivery destination
  useEffect(() => {
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];
    setRouteSummary(null);

    if (!routesLib || !map || !selectedPlace || !destinationPlace) return;

    let cancelled = false;
    const computeDeliveryRoute = async () => {
      try {
        const routeApi = routesLib.Route as unknown as {
          computeRoutes: (req: unknown) => Promise<{
            routes?: Array<{
              distanceMeters?: number;
              durationMillis?: number;
              viewport?: google.maps.LatLngBounds;
              createPolylines: () => google.maps.Polyline[];
            }>;
          }>;
        };
        const { routes } = await routeApi.computeRoutes({
          origin: selectedPlace.position,
          destination: destinationPlace.position,
          travelMode: 'DRIVING',
          fields: ['path', 'distanceMeters', 'durationMillis', 'viewport'],
        });

        if (cancelled || !routes || routes.length === 0) return;
        const primaryRoute = routes[0];
        const newPolylines = primaryRoute.createPolylines();
        newPolylines.forEach((polyline) => {
          polyline.setOptions({
            strokeColor: '#1D4ED8',
            strokeWeight: 5,
          });
          polyline.setMap(map);
        });
        polylinesRef.current = newPolylines;

        if (primaryRoute.viewport) {
          map.fitBounds(primaryRoute.viewport);
        }

        setRouteSummary({
          distanceKm: ((primaryRoute.distanceMeters ?? 0) / 1000).toFixed(1),
          durationMin: Math.max(1, Math.round((primaryRoute.durationMillis ?? 0) / 60000)),
        });
      } catch (err) {
        handleQuotaCheck(err);
      }
    };

    void computeDeliveryRoute();

    return () => {
      cancelled = true;
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [routesLib, map, selectedPlace, destinationPlace, handleQuotaCheck]);

  if (loadingStatus === APILoadingStatus.FAILED || loadingStatus === APILoadingStatus.AUTH_FAILURE) {
    return (
      <div className="rounded-2xl border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#13161C] p-8 text-center text-sm text-[#525866] dark:text-[#9CA3AF]">
        {lang === 'ar'
          ? 'حصلت مشكلة في تحميل خرائط جوجل. اتأكد من تفعيل مفتاح الخرائط.'
          : 'Unable to load Google Maps. Please check your Maps API key status.'}
      </div>
    );
  }

  return (
    <div className={compact ? 'flex flex-col gap-3' : 'grid gap-6 lg:grid-cols-12'}>
      {/* Left/Start Panel: Address Search, Store List & Route Summary */}
      <div className={compact ? 'flex flex-col gap-2.5' : 'lg:col-span-5 flex flex-col gap-4'}>
        <form onSubmit={(e) => void handleSearchSubmit(e)} className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 start-3.5 h-4 w-4 -translate-y-1/2 text-[#525866] dark:text-[#9CA3AF]"
            aria-hidden="true"
          />
          <input
            type="text"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder={
              lang === 'ar'
                ? 'دور على عنوان التوصيل أو المنطقة في مصر...'
                : 'Search delivery address or area in Egypt...'
            }
            className="h-11 w-full rounded-xl border border-black/[0.12] dark:border-white/[0.14] bg-white dark:bg-[#13161C] ps-10 pe-20 text-sm text-[#0F1115] dark:text-[#F4F5F7] placeholder:text-[#525866]/65 dark:placeholder:text-[#9CA3AF]/65 focus:border-[#1D4ED8] focus:outline-none"
          />
          <button
            type="submit"
            disabled={isSearching}
            className="absolute end-1.5 top-1/2 -translate-y-1/2 inline-flex h-8 items-center rounded-lg bg-[#0F1115] px-3 text-xs font-semibold text-white hover:bg-[#1D4ED8] dark:bg-[#F4F5F7] dark:text-[#0B0D11] cursor-pointer"
          >
            {lang === 'ar' ? 'حدد' : 'Locate'}
          </button>

          {suggestions.length > 0 && (
            <ul className="absolute z-30 mt-1.5 w-full rounded-xl border border-black/[0.1] dark:border-white/[0.12] bg-white dark:bg-[#13161C] shadow-xl overflow-hidden divide-y divide-black/[0.06] dark:divide-white/[0.08]">
              {suggestions.map((suggestion, idx) => (
                <li key={suggestion.placePrediction?.placeId || idx}>
                  <button
                    type="button"
                    onClick={() => void handleSelectSuggestion(suggestion)}
                    className="w-full px-4 py-2.5 text-start text-xs text-[#0F1115] dark:text-[#F4F5F7] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] flex items-center gap-2 cursor-pointer"
                  >
                    <MapPin className="h-3.5 w-3.5 text-[#1D4ED8] dark:text-[#60A5FA] shrink-0" />
                    <span className="truncate">{suggestion.placePrediction?.text.text}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </form>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleUseCurrentGps}
            disabled={isLocating}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-black/[0.12] dark:border-white/[0.14] bg-white dark:bg-[#13161C] px-3 text-xs font-semibold text-[#0F1115] dark:text-[#F4F5F7] hover:border-[#1D4ED8] hover:text-[#1D4ED8] dark:hover:border-[#60A5FA] dark:hover:text-[#60A5FA] transition-colors cursor-pointer disabled:opacity-60"
          >
            {isLocating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <LocateFixed className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>
              {lang === 'ar' ? 'استخدم موقعي الحالي' : 'Use My Current Location'}
            </span>
          </button>

          <span className="text-[11px] text-[#525866] dark:text-[#9CA3AF]">
            {lang === 'ar'
              ? 'أو اضغط على أي نقطة على الخريطة'
              : 'Or click anywhere on the map'}
          </span>
        </div>

        {isPickingForCheckout && destinationPlace && onConfirmCheckoutLocation && (
          <button
            type="button"
            onClick={onConfirmCheckoutLocation}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1D4ED8] px-4 text-xs font-semibold text-white hover:bg-[#1E40AF] dark:bg-[#3B82F6] dark:hover:bg-[#2563EB] transition-colors cursor-pointer"
          >
            <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              {lang === 'ar'
                ? 'تأكيد اللوكيشن والرجوع لإكمال الأوردر'
                : 'Confirm Location & Return to Checkout'}
            </span>
          </button>
        )}

        {routeSummary && destinationPlace && (
          <div className="rounded-xl border border-[#1D4ED8]/25 bg-[#1D4ED8]/5 dark:bg-[#3B82F6]/10 p-4 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-[#1D4ED8] dark:text-[#60A5FA]">
              <span className="inline-flex items-center gap-1.5">
                <Navigation className="h-3.5 w-3.5" />
                {lang === 'ar' ? 'مسار التوصيل في مصر' : 'Delivery Route in Egypt'}
              </span>
              <span className="tabular-nums">
                {routeSummary.distanceKm} km · {routeSummary.durationMin}{' '}
                {lang === 'ar' ? 'دقيقة' : 'min'}
              </span>
            </div>
            <p className="text-xs text-[#525866] dark:text-[#D1D5DB] truncate">
              {destinationPlace.address}
            </p>
          </div>
        )}

        {mapError && (
          <p className="text-xs text-red-600 dark:text-red-400">{mapError}</p>
        )}

        {!compact && (
          <div className="space-y-2.5">
            <p className="text-xs font-semibold text-[#525866] dark:text-[#9CA3AF]">
              {lang === 'ar' ? 'فروع ومواقع الأزياء في مصر' : 'Fashion Locations in Egypt'}
            </p>
            {places.length === 0 ? (
              <div className="rounded-xl border border-black/[0.07] dark:border-white/[0.08] bg-white dark:bg-[#13161C] p-4 text-xs text-[#525866] dark:text-[#9CA3AF]">
                {lang === 'ar' ? 'جاري تحميل الفروع في مصر...' : 'Loading Egypt locations...'}
              </div>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-y-auto pe-1">
                {places.map((place) => {
                  const isSelected = selectedPlace?.id === place.id;
                  return (
                    <button
                      key={place.id}
                      type="button"
                      onClick={() => {
                        setSelectedPlace(place);
                        map?.panTo(place.position);
                        map?.setZoom(14);
                      }}
                      className={`w-full rounded-xl border p-3.5 text-start transition-colors cursor-pointer ${
                        isSelected
                          ? 'border-[#1D4ED8] bg-[#1D4ED8]/5 dark:border-[#60A5FA] dark:bg-[#3B82F6]/10'
                          : 'border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#13161C] hover:border-black/20 dark:hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-semibold text-[#0F1115] dark:text-[#F4F5F7]">
                          {place.name}
                        </span>
                        {typeof place.rating === 'number' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 shrink-0">
                            <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                            {place.rating.toFixed(1)}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-[#525866] dark:text-[#9CA3AF] line-clamp-2">
                        {place.address}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right/End Panel: Interactive Map Focused Strictly on Egypt */}
      <div
        className={
          compact
            ? 'overflow-hidden rounded-xl border border-black/[0.08] dark:border-white/[0.1] bg-[#EBEDF0] dark:bg-[#13161C] h-[230px]'
            : 'lg:col-span-7 overflow-hidden rounded-2xl border border-black/[0.08] dark:border-white/[0.1] bg-[#EBEDF0] dark:bg-[#13161C] h-[380px] sm:h-[440px]'
        }
      >
        <GoogleMap
          mapId="DEMO_MAP_ID"
          defaultCenter={DEFAULT_CENTER}
          defaultZoom={11}
          minZoom={5}
          restriction={{ latLngBounds: EGYPT_BOUNDS, strictBounds: true }}
          gestureHandling="greedy"
          onClick={handleMapClick}
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          style={{ width: '100%', height: '100%' }}
        >
          {places.map((place) => (
            <PlacePin
              key={place.id}
              place={place}
              selected={selectedPlace?.id === place.id}
              onSelect={(p) => setSelectedPlace(p)}
            />
          ))}

          {destinationPlace && (
            <AdvancedMarker position={destinationPlace.position} title={destinationPlace.name}>
              <Pin background="#059669" borderColor="#047857" glyphColor="#FFFFFF" scale={1.15}>
                <LocateFixed className="h-3.5 w-3.5" />
              </Pin>
            </AdvancedMarker>
          )}
        </GoogleMap>
      </div>
    </div>
  );
}

export function AtelierLocationsMap({
  lang,
  apiKey,
  onSelectDeliveryAddress,
  compact = false,
  isPickingForCheckout,
  onConfirmCheckoutLocation,
}: AtelierLocationsMapProps) {
  if (!apiKey) {
    return (
      <div className="rounded-2xl border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#13161C] p-6 text-center text-xs text-[#525866] dark:text-[#9CA3AF]">
        {lang === 'ar'
          ? 'مفتاح خرائط جوجل مش متاح دلوقتي. اعمل ريستارت للسيرفر أو اتأكد من إعدادات الخرائط.'
          : 'Google Maps API key is not active yet. Restart the server or check Maps setup.'}
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey} language={lang} region="EG" libraries={['places', 'routes', 'marker']}>
      <MapWorkspace
        lang={lang}
        compact={compact}
        onSelectDeliveryAddress={onSelectDeliveryAddress}
        isPickingForCheckout={isPickingForCheckout}
        onConfirmCheckoutLocation={onConfirmCheckoutLocation}
      />
    </APIProvider>
  );
}
