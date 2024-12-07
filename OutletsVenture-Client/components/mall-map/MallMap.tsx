"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Box, Typography, Button, IconButton } from "@mui/material";
import {
  Home,
  AccessibleForward,
  Warning,
  Menu,
  ChevronLeft,
} from "@mui/icons-material";
import { useRouter } from "next/navigation";
import { message } from "antd/lib";
import { ref as dbRef, onValue, update } from "firebase/database";
import { db } from "@/utils/firebase";
import {
  disasterEarthquakeMap,
  disasterEmergencyMap,
  disasterHarazardMap,
  mallAboitizMap,
  mallFlavorsMap,
  mallFood,
  mallLoopMap,
  mallMap,
  mallParkadeMap,
  mallPlazaMap,
  mallPromenadeMap,
  mallService,
  mallShop,
} from "@/utils/References";
import { MapData } from "@/utils/Types";

const MallMap = () => {
  const router = useRouter();
  const [activeMap, setActiveMap] = useState<string>("/2dMapDefault.png");
  const [mapType, setMapType] = useState<"map2D" | "map360" | "mapRoute">(
    "map2D"
  );
  const [activeCategory, setActiveCategory] = useState<
    "navigation" | "emergency" | "amenities"
  >("navigation");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSelectingShop, setIsSelectingShop] = useState(false);
  const [shops, setShops] = useState<MapData[]>([]);
  const [shopMap, setShopMap] = useState<MapData>();
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [currentMap, setCurrentMap] = useState<MapData>();

  const categories: {
    [key in "navigation" | "emergency" | "amenities"]: string[];
  } = {
    navigation: [
      "Promenade Shops",
      "Plaza",
      "Parkade",
      "Loop",
      "Flavors",
      "Aboitiz Pitch",
    ],
    emergency: ["Fire Routes", "Earthquake Routes", "Hazard Areas"],
    amenities: ["Restrooms", "ATMs", "Information Desks"],
  };

  const mallReferences = [
    `${mallPromenadeMap}/${mallFood}`,
    `${mallPromenadeMap}/${mallShop}`,
    `${mallPromenadeMap}/${mallService}`,
    `${mallPlazaMap}/${mallFood}`,
    `${mallPlazaMap}/${mallShop}`,
    `${mallPlazaMap}/${mallService}`,
    `${mallParkadeMap}/${mallFood}`,
    `${mallParkadeMap}/${mallShop}`,
    `${mallParkadeMap}/${mallService}`,
    `${mallLoopMap}/${mallFood}`,
    `${mallLoopMap}/${mallShop}`,
    `${mallLoopMap}/${mallService}`,
    `${mallFlavorsMap}/${mallFood}`,
    `${mallFlavorsMap}/${mallShop}`,
    `${mallFlavorsMap}/${mallService}`,
    `${mallAboitizMap}/${mallFood}`,
    `${mallAboitizMap}/${mallShop}`,
    `${mallAboitizMap}/${mallService}`,
  ];

  useEffect(() => {
    let mapURL = undefined;
    if (shopMap) {
      mapURL =
        mapType === "map2D"
          ? shopMap.map2D
          : mapType === "map360"
          ? shopMap.map360
          : shopMap.mapRoute;

      if (mapURL === undefined) {
        if (!isLoading) message.error("No data found for this map.");
        return;
      }
      setActiveMap(mapURL);
    } else {
      if (!isLoading) message.error("No data found for this map.");
    }
  }, [mapType, shopMap, isLoading]);

  useEffect(() => {
    if (searchTerm === "") {
      setIsSelectingShop(false);
      setShops([]);
      return;
    }

    const matchingShops: MapData[] = [];

    mallReferences.forEach((reference) => {
      const shopMapsRef = dbRef(db, `${reference}`);
      console.log("Checking: " + `${reference}`);

      onValue(shopMapsRef, (snapshot) => {
        const data = snapshot.val();

        if (data) {
          const shops = data as MapData[];
          const filteredShops = shops
            .map((shop) => ({
              ...shop,
              storeName: `${shop.storeName} (${
                reference.includes("Shop")
                  ? "Shop"
                  : reference.includes("Dine")
                  ? "Dine"
                  : "Service"
              })`,
            }))
            .filter((shop) =>
              shop.storeName.toLowerCase().includes(searchTerm.toLowerCase())
            );

          matchingShops.push(...filteredShops);
          if (matchingShops.length > 0) {
            setIsSelectingShop(true);
            setShops(matchingShops);
          }
        }
      });
    });
  }, [searchTerm]);

  const handleMapButtonClick = (category: string, map: string) => {
    setIsLoading(false);
    if (category === "navigation") {
      setIsSelectingShop(true);
      const shopMapsRef = dbRef(db, `${mallMap}/${map}/Shop`);
      console.log(`${mallMap}/${map}/Shop`);
      onValue(shopMapsRef, (snapshot) => {
        const data = snapshot.val();
        setShops(data);
      });
    } else {
      let mapRef = undefined;
      if (map === "Fire Routes") {
        mapRef = dbRef(db, disasterEmergencyMap);
      } else if (map === "Earthquake Routes") {
        mapRef = dbRef(db, disasterEarthquakeMap);
      } else {
        mapRef = dbRef(db, disasterHarazardMap);
      }
      onValue(mapRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) {
          message.error("No data found for this map.");
          return;
        }
        setShopMap(data);
        let mapURL =
          mapType === "map2D"
            ? data.map2D
            : mapType === "map360"
            ? data.map360
            : data.mapRoute;

        if (mapURL === undefined) {
          message.error(
            "No data found for this map, using the other map type."
          );
          mapURL = mapType === "map2D" ? data.map360 : data.mapRoute;
          if (mapURL === undefined) {
            message.error("No data found for any map types.");
            return;
          }
        }
        setActiveMap(mapURL);
      });
    }
  };

  const handleCategoryChange = (
    category: "navigation" | "emergency" | "amenities"
  ) => {
    setActiveCategory(category);
  };

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  const ShowShopMap = (map: MapData & { refPath: string }) => {
    setCurrentMap(map);
    setShopMap(map);
    let mapURL =
      mapType === "map2D"
        ? map.map2D
        : mapType === "map360"
        ? map.map360
        : map.mapRoute;

    if (mapURL === undefined) {
      message.error("No data found for this map, using the other map type.");
      mapURL = mapType === "map2D" ? map.map360 : map.mapRoute;
      if (mapURL === undefined) {
        message.error("No data found for any map types.");
        return;
      }
    }
    map.clicks = map.clicks ? map.clicks + 1 : 1;
    if (searchTerm !== "") map.searches = map.searches ? map.searches + 1 : 1;

    const updates = {
      clicks: map.clicks,
      searches: map.searches ? map.searches : 0,
    };

    const mapRef = dbRef(db, `${map.refPath}/${map.id}`);
    update(mapRef, updates);
    setActiveMap(mapURL);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handle360ViewClick = () => {
    console.log(currentMap);
    if (!currentMap) return;
    router.push(`/mall-map/360?sceneId=${currentMap.cloudPanoSceneID}`);
  };

  return (
    <Box
      sx={{
        display: "flex",
        height: "100vh",
        flexDirection: { xs: "column", md: "row" },
      }}
    >
      {/* Collapsible Sidebar */}
      <Box
        sx={{
          width: isSidebarOpen
            ? { xs: "100%", md: "20%" }
            : { xs: "100%", md: "8%" },
          backgroundColor: "#b71c1c",
          padding: isSidebarOpen ? "20px" : "10px",
          mb: isSidebarOpen ? "0px" : "60px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          boxShadow: isSidebarOpen ? "2px 0px 5px rgba(0, 0, 0, 0.1)" : "none",
          transition: "width 0.3s",
          borderTopRightRadius: "40px",
          borderBottomRightRadius: "40px",
        }}
      >
        <Box sx={{ position: "relative" }}>
          {isSidebarOpen && (
            <Typography
              variant="h4"
              color="white"
              sx={{ mb: 3, fontWeight: "bold" }}
            >
              Mall Map
            </Typography>
          )}

          {isSidebarOpen && (
            <>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  backgroundColor: "white",
                  borderRadius: "20px",
                  px: 2,
                  py: 1,
                  mb: 2,
                }}
              >
                <input
                  type="text"
                  placeholder="Search"
                  value={searchTerm}
                  onChange={handleSearchChange}
                  style={{
                    border: "none",
                    flex: 1,
                    outline: "none",
                    fontSize: "16px",
                    padding: "5px",
                  }}
                />
              </Box>

              {!isSelectingShop ? (
                categories[activeCategory].map((item) => (
                  <Button
                    fullWidth
                    sx={navButtonStyle}
                    key={item}
                    onClick={() => handleMapButtonClick(activeCategory, item)}
                  >
                    {item}
                  </Button>
                ))
              ) : (
                <>
                  <Box
                    sx={{
                      maxHeight: "600px",
                      overflowY: "auto",
                      mb: 2,
                      scrollbarWidth: "thin",
                    }}
                  >
                    {shops?.map((shop, index) => (
                      <Button
                        fullWidth
                        sx={navButtonStyle}
                        key={shop.storeName}
                        onClick={() =>
                          ShowShopMap({
                            ...shop,
                            refPath: mallReferences[index],
                          })
                        }
                      >
                        {shop.storeName}
                      </Button>
                    ))}
                  </Box>
                  <Button
                    fullWidth
                    sx={navButtonStyle}
                    onClick={() => {
                      setIsSelectingShop(false);
                      setShops([]);
                    }}
                  >
                    Back
                  </Button>
                </>
              )}
            </>
          )}

          {/* Toggle Sidebar Button */}
          <IconButton
            onClick={toggleSidebar}
            sx={{
              color: "white",
              backgroundColor: "#b71c1c",
              borderRadius: "50%",
              p: 2,
              position: "absolute",
              top: "10px",
              right: isSidebarOpen ? "-15px" : "-10px",
              transform: isSidebarOpen ? "rotate(0deg)" : "rotate(180deg)",
              transition: "transform 0.3s",
              "&:hover": {
                backgroundColor: "#d32f2f",
              },
            }}
          >
            {isSidebarOpen ? <ChevronLeft /> : <Menu />}
          </IconButton>
        </Box>
      </Box>

      {/* Main Content Area */}
      <Box
        sx={{
          flex: 1,
          p: { xs: "10px", md: "20px" },
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#ffffff",
          boxShadow: "inset 0px 0px 10px rgba(0, 0, 0, 0.1)",
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            mb: 3,
            gap: { xs: "2px", md: "10px" },
          }}
        >
          <Button
            sx={{
              backgroundColor: "#b71c1c",
              color: "white",
              borderRadius: "10px",
              px: { xs: 2, md: 3 },
              py: { xs: 1, md: 1.5 },
              fontSize: { xs: "12px", md: "16px" },
              width: { xs: "50%", sm: "auto" },
            }}
            onClick={handle360ViewClick}
          >
            360 Map (Current)
          </Button>
          <IconButton
            sx={iconButtonStyle}
            onClick={() => handleCategoryChange("navigation")}
          >
            <Home />
          </IconButton>
          <IconButton
            sx={iconButtonStyle}
            onClick={() => handleCategoryChange("emergency")}
          >
            <Warning />
          </IconButton>
          <IconButton
            sx={iconButtonStyle}
            onClick={() => handleCategoryChange("amenities")}
          >
            <AccessibleForward />
          </IconButton>
        </Box>

        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: { xs: "70vh", md: "90vh" },
            backgroundColor: "#fafafa",
          }}
        >
          <Box
            sx={{
              position: "relative",
              display: "inline-block",
              borderRadius: "15px",
              boxShadow: "0px 4px 15px rgba(0, 0, 0, 0.1)",
              width: "100%",
              maxWidth: "600px",
              height: "auto",
            }}
          >
            {/* Image Element */}
            {isLoading ? (
              <div className="animate-pulse bg-gray-300 h-[800px] w-[600px] rounded-lg" />
            ) : (
              <Image
                src={activeMap}
                alt="Mall Map"
                layout="responsive"
                objectFit="contain"
                width={600}
                height={800}
                style={{
                  borderRadius: "15px",
                }}
              />
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

const navButtonStyle = {
  backgroundColor: "white",
  color: "#b71c1c",
  borderRadius: "10px",
  padding: "10px",
  marginBottom: "10px",
  fontSize: { xs: "14px", md: "18px" }, // Adjust font size based on screen size
  fontWeight: "bold",
  textAlign: "center",
  "&:hover": {
    backgroundColor: "#f5f5f5",
  },
};

const iconButtonStyle = {
  backgroundColor: "#d32f2f",
  color: "white",
  borderRadius: "50%",
  padding: "10px",
  marginLeft: "10px",
  "&:hover": {
    backgroundColor: "#b71c1c",
  },
};

export default MallMap;
