"use client";
import { useState, useEffect } from "react";
import { ref, onValue, push } from "firebase/database";
import { db } from "@/utils/firebase";
import { Modal } from "antd/lib";
import MapCanvas from "@/components/routes/MapCanvas"; // Adjust this path as needed

type Point = [number, number];
type Shop = { id: string; title: string };

const Page = () => {
  const [shops, setShops] = useState<Shop[]>([]);
  const [routes, setRoutes] = useState<string[]>(["Select Route"]);
  const [selectedShop, setSelectedShop] = useState<string>("");
  const [selectedRoute, setSelectedRoute] = useState<string>();
  const [selectedDestination, setSelectedDestination] = useState<string>("");
  const [initialPoints, setInitialPoints] = useState<Point[]>([]);
  const [routeSelections, setRouteSelections] = useState<
    Record<string, number>
  >({});
  const SELECTION_WINDOW = 10 * 60 * 1000; // 10 minutes in milliseconds
  const CONGESTION_THRESHOLD = 10; // Define the threshold for congestion

  // Fetch shops with onValue for real-time updates
  useEffect(() => {
    const shopsRef = ref(db, "Shops");

    const unsubscribe = onValue(shopsRef, (snapshot) => {
      if (snapshot.exists()) {
        const shopList: Shop[] = [];
        snapshot.forEach((childSnapshot) => {
          const shopId = childSnapshot.key;
          const shopData = childSnapshot.val();
          if (shopId && shopData?.title) {
            shopList.push({ id: shopId, title: shopData.title });
          }
        });
        setShops(shopList);
      }
    });

    return () => unsubscribe();
  }, []);

  // Fetch routes with onValue for real-time updates
  useEffect(() => {
    if (!selectedShop || !selectedDestination) return;

    const shopRoutesRef = ref(db, `Routes/${selectedShop}`);
    const destinationRoutesRef = ref(db, `Routes/${selectedDestination}`);

    const unsubscribeShop = onValue(shopRoutesRef, (snapshot) => {
      const shopRoutes = snapshot.exists()
        ? Object.keys(snapshot.val()).filter((route) => {
            const routeData = snapshot.val()[route];
            return (
              (routeData?.origin === selectedShop &&
                routeData?.destination === selectedDestination) ||
              (routeData?.origin === selectedDestination &&
                routeData?.destination === selectedShop)
            );
          })
        : [];

      const unsubscribeDestination = onValue(
        destinationRoutesRef,
        (destinationSnapshot) => {
          const destinationRoutes = destinationSnapshot.exists()
            ? Object.keys(destinationSnapshot.val()).filter((route) => {
                const routeData = destinationSnapshot.val()[route];
                return (
                  (routeData?.origin === selectedShop &&
                    routeData?.destination === selectedDestination) ||
                  (routeData?.origin === selectedDestination &&
                    routeData?.destination === selectedShop)
                );
              })
            : [];

          const combinedRoutes = Array.from(
            new Set(["Select Route", ...shopRoutes, ...destinationRoutes])
          );
          setRoutes(combinedRoutes);
        }
      );

      return () => {
        unsubscribeShop();
        unsubscribeDestination();
      };
    });
  }, [selectedShop, selectedDestination]);

  // Fetch route points with onValue for real-time updates
  useEffect(() => {
    if (!selectedShop && !selectedDestination) {
      setInitialPoints([]);
      return;
    }

    const shopRouteRef = ref(db, `Routes/${selectedShop}/${selectedRoute}`);
    const destinationRouteRef = ref(
      db,
      `Routes/${selectedDestination}/${selectedRoute}`
    );

    const unsubscribeShop = onValue(shopRouteRef, (snapshot) => {
      if (snapshot.exists()) {
        setInitialPoints(snapshot.val().points || []);
      } else {
        const unsubscribeDestination = onValue(
          destinationRouteRef,
          (destinationSnapshot) => {
            if (destinationSnapshot.exists()) {
              setInitialPoints(destinationSnapshot.val().points || []);
            }
          }
        );

        return unsubscribeDestination;
      }
    });

    return () => unsubscribeShop();
  }, [selectedRoute, selectedShop, selectedDestination]);

  // Monitor route selection events for congestion detection
  useEffect(() => {
    const heatmapRef = ref(db, "Heatmap");

    const unsubscribe = onValue(heatmapRef, (snapshot) => {
      if (snapshot.exists()) {
        const now = Date.now();
        const selectionCounts: Record<string, number> = {};

        snapshot.forEach((childSnapshot) => {
          const eventData = childSnapshot.val();
          if (eventData.event === "route_selection" && eventData.timestamp) {
            const routeId = eventData.routeId;
            const eventTime = eventData.timestamp;

            if (now - eventTime <= SELECTION_WINDOW) {
              selectionCounts[routeId] = (selectionCounts[routeId] || 0) + 1;
            }
          }
        });

        setRouteSelections(selectionCounts);
      }
    });

    return () => unsubscribe();
  }, []);

  const showCongestionWarning = () => {
    Modal.warning({
      title: "Route Congestion Warning",
      content: "This route is currently congested. Consider alternatives.",
    });
  };

  const logRouteSelection = (routeId: string) => {
    const heatmapRef = ref(db, "Heatmap");
    push(heatmapRef, {
      event: "route_selection",
      routeId,
      timestamp: Date.now(),
    });

    // Check if the selected route is congested
    if (routeSelections[routeId] >= CONGESTION_THRESHOLD) {
      showCongestionWarning(); // Show the modal dialog
    }
  };

  const onValueChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const { id, value } = event.target;

    if (id === "shop") {
      setSelectedShop(value);
      setSelectedDestination(""); // Reset destination to ensure a fresh selection
      setRoutes([]); // Clear route options temporarily until destination is re-selected
    } else if (id === "destination") {
      setSelectedDestination(value);
    } else if (id === "route") {
      setSelectedRoute(value);
      logRouteSelection(value); // Log the route selection
    }
  };

  return (
    <div
      className="min-h-screen bg-cover bg-center"
      style={{ backgroundImage: "url(/img_background_pattern.png)" }}
    >
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg mt-10 relative z-10">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Route Maker</h1>

        {/* Dropdown for Shop selection */}
        <div className="mb-4">
          <label
            htmlFor="shop"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Origin:
          </label>
          <select
            id="shop"
            value={selectedShop}
            onChange={onValueChange}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="">Select Origin</option>
            {shops.map((shop) => (
              <option key={shop.id} value={shop.id}>
                {shop.title}
              </option>
            ))}
          </select>
        </div>

        {/* Dropdown for Destination selection */}
        <div className="mb-4">
          <label
            htmlFor="destination"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Destination:
          </label>
          <select
            id="destination"
            value={selectedDestination}
            onChange={onValueChange}
            disabled={!selectedShop} // Disable if no shop is selected
            className={`w-full border rounded-lg px-3 py-2 ${
              !selectedShop
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "text-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            }`}
          >
            <option value="">Select Destination</option>
            {shops
              .filter((shop) => shop.id !== selectedShop) // Exclude the selected shop from the destination list
              .map((shop) => (
                <option key={shop.id} value={shop.id}>
                  {shop.title}
                </option>
              ))}
          </select>
        </div>

        {/* Dropdown for Route selection */}
        <div className="mb-6">
          <label
            htmlFor="route"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Route:
          </label>
          <select
            id="route"
            value={selectedRoute}
            onChange={onValueChange}
            disabled={!selectedShop || !selectedDestination} // Disable if origin or destination is not selected
            className={`w-full border rounded-lg px-3 py-2 ${
              !selectedShop || !selectedDestination
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "text-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            }`}
          >
            {routes.map((route) => (
              <option key={route} value={route}>
                {route}
              </option>
            ))}
          </select>
        </div>

        {/* Canvas with map and points */}
        <div className="mb-6">
          <MapCanvas imageSrc="/images/map.png" initialPoints={initialPoints} />
        </div>
      </div>
    </div>
  );
};

export default Page;
