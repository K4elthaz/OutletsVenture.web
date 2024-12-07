"use client";
import { message } from "antd/lib";
import { useState, useEffect } from "react";
import { ref, onValue, child, get, set } from "firebase/database";
import { db } from "@/utils/firebase";
import MapCanvas from "@/app/(DashboardLayout)/content/routes/MapCanvas"; // Adjust this path as needed
import { Button, Select, Space, Typography } from "antd";

type Point = [number, number];
type Shop = { id: string; title: string };

const Page = () => {
  const [shops, setShops] = useState<Shop[]>([]);
  const [routes, setRoutes] = useState<string[]>([]);
  const [selectedShop, setSelectedShop] = useState<string>("");
  const [selectedRoute, setSelectedRoute] =
    useState<string>("Create new route");
  const [selectedDestination, setSelectedDestination] = useState<string>("");
  const [savedPoints, setSavedPoints] = useState<Point[]>([]);
  const [initialPoints, setInitialPoints] = useState<Point[]>([]);

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

    return () => unsubscribe(); // Unsubscribe from updates when the component unmounts
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
            new Set(["Create new route", ...shopRoutes, ...destinationRoutes])
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
    if (
      selectedRoute === "Create new route" ||
      (!selectedShop && !selectedDestination)
    ) {
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

  const onValueChange = (value: string, id: string) => {
    if (id === "shop") {
      setSelectedShop(value);
      setSelectedRoute("Create new route"); // Reset route selection
      setSelectedDestination(""); // Reset destination to ensure a fresh selection
      setRoutes([]); // Clear route options temporarily until destination is re-selected
    } else if (id === "destination") {
      setSelectedDestination(value);
      setSelectedRoute("Create new route"); // Reset route selection to "Create new route"
    } else if (id === "route") {
      setSelectedRoute(value);
    }
  };

  const handleSavePoints = (points: Point[]) => {
    setSavedPoints(points);
  };

  const handleSaveRoute = async () => {
    if (
      !selectedShop ||
      !selectedDestination ||
      selectedDestination === selectedShop
    ) {
      message.error("Please select two distinct locations.");
      return;
    }

    let newRouteKey = "";
    let routeRef;

    if (selectedRoute === "Create new route") {
      // Reference the routes under the selected shop
      const shopRoutesRef = ref(db, `Routes/${selectedShop}`);
      const destinationRoutesRef = ref(db, `Routes/${selectedDestination}`);

      // Fetch all existing routes for both origin and destination
      const [shopRoutesSnapshot, destinationRoutesSnapshot] = await Promise.all(
        [get(shopRoutesRef), get(destinationRoutesRef)]
      );

      const existingRoutes = new Set<string>();

      // Add route names from the shop reference
      if (shopRoutesSnapshot.exists()) {
        Object.keys(shopRoutesSnapshot.val()).forEach((route) =>
          existingRoutes.add(route)
        );
      }

      // Count existing routes between the specific origin and destination
      const routeCount = Array.from(existingRoutes).filter((route) =>
        route.startsWith("Route")
      ).length;

      // Generate the new route key
      newRouteKey = `Route ${routeCount + 1}`;
      routeRef = child(shopRoutesRef, newRouteKey);
    } else {
      // Use the existing route reference
      routeRef = child(ref(db), `Routes/${selectedShop}/${selectedRoute}`);
      newRouteKey = selectedRoute; // Keep the selected route as the key
    }

    // Save data in a format that supports interchangeable origin/destination
    const routeData = {
      points: savedPoints,
      origin: selectedShop,
      destination: selectedDestination,
      clicks: {},
    };

    await set(routeRef, routeData);

    // Also save the reverse route for consistency
    const reverseRouteRef = child(
      ref(db),
      `Routes/${selectedDestination}/${newRouteKey}`
    );
    await set(reverseRouteRef, routeData);

    // Update the selectedRoute state to the newly generated key
    if (selectedRoute === "Create new route" && newRouteKey) {
      setSelectedRoute(newRouteKey);
    }

    message.success("Route saved successfully!");
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>Route Maker</h1>
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        {/* Shop Selection */}
        <div>
          <label htmlFor="shop">Origin: </label>
          <Select
            id="shop"
            value={selectedShop}
            onChange={(value) => onValueChange(value, "shop")}
            placeholder="Select Origin"
            style={{ width: "100%" }}
          >
            {shops.map((shop) => (
              <Select.Option key={shop.id} value={shop.id}>
                {shop.title}
              </Select.Option>
            ))}
          </Select>
        </div>

        {/* Destination Selection */}
        <div>
          <label htmlFor="destination">Destination: </label>
          <Select
            id="destination"
            value={selectedDestination}
            onChange={(value) => onValueChange(value, "destination")}
            placeholder="Select Destination"
            disabled={!selectedShop}
            style={{ width: "100%" }}
          >
            {shops
              .filter((shop) => shop.id !== selectedShop)
              .map((shop) => (
                <Select.Option key={shop.id} value={shop.id}>
                  {shop.title}
                </Select.Option>
              ))}
          </Select>
        </div>

        {/* Route Selection */}
        <div>
          <label htmlFor="route">Route: </label>
          <Select
            id="route"
            value={selectedRoute}
            onChange={(value) => onValueChange(value, "route")}
            placeholder="Select Route"
            disabled={!selectedShop || !selectedDestination}
            style={{ width: "100%" }}
          >
            {routes.map((route) => (
              <Select.Option key={route} value={route}>
                {route}
              </Select.Option>
            ))}
          </Select>
        </div>

        {/* Save Route Button */}
        <Button
          type="primary"
          onClick={handleSaveRoute}
          disabled={
            !selectedShop || !selectedDestination || savedPoints.length === 0
          }
        >
          Save Route To Database
        </Button>
      </Space>

      {/* MapCanvas Component */}
      <div style={{ marginTop: "20px" }}>
        <MapCanvas
          imageSrc="/images/map.png"
          onSave={setSavedPoints}
          initialPoints={initialPoints}
        />
      </div>
    </div>
  );
};
export default Page;
