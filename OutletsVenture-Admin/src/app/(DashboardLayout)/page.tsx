"use client";
import { Grid, Box, Button } from "@mui/material";
import PageContainer from "@/app/(DashboardLayout)/components/container/PageContainer";
import ShopClicks from "@/app/(DashboardLayout)/components/dashboard/ShopClicks";
import ShopInfo from "@/app/(DashboardLayout)/components/dashboard/ShopInfo";
import VisitsChart from "./components/dashboard/VisitsChart";
import MapsCharts from "./components/dashboard/MapsCharts";
import MapInfo from "./components/dashboard/MapInfo";
import Feedback from "./components/dashboard/Feedback";
import { useEffect, useState } from "react";
import * as XLSX from "xlsx"; // Import SheetJS

const Dashboard = () => {
  const [dataSet, setDataSet] = useState<any[]>([]);

  const onChartUpdate = (data: any) => {
    if (!data || data.length === 0) return null;
    setDataSet([...dataSet, data]);
    return null;
  };

  const exportToExcel = () => {
    // Create a new workbook
    const workbook = XLSX.utils.book_new();

    dataSet.forEach((data, index) => {
      let worksheet;

      if (Array.isArray(data)) {
        // Handle the first format (Array of Objects)
        // Ensure the correct header row is created with each object in the array
        worksheet = XLSX.utils.json_to_sheet(data, {
          header: ["storeName", "clicks", "searches"],
        });
      } else if (data.used && data.preferred && data.titles) {
        // Handle the second format (Object with arrays)
        // Prepare the data for the worksheet
        const formattedData = data.titles.map((title: string, i: number) => ({
          title,
          used: data.used[i],
          preferred: data.preferred[i],
        }));

        // Convert the formatted data into a worksheet
        worksheet = XLSX.utils.json_to_sheet(formattedData);
      } else {
        // If the data format is unrecognized, skip it
        return;
      }

      // Append the worksheet to the workbook with a unique sheet name
      XLSX.utils.book_append_sheet(workbook, worksheet, `Sheet${index + 1}`);
    });

    // Write the workbook to a file and trigger download
    XLSX.writeFile(workbook, "Dashboard_Data.xlsx");
  };

  useEffect(() => {
    console.log(dataSet);
  }, [dataSet]);

  return (
    <PageContainer title="Dashboard" description="this is Dashboard">
      <Box>
        <Grid container spacing={3}>
          <Grid item xs={24} lg={24}>
            <Button variant="contained" color="primary" onClick={exportToExcel}>
              Export All Data To Excel
            </Button>
          </Grid>
          <Grid item xs={24} lg={24}>
            <Feedback onChartUpdate={onChartUpdate} />
          </Grid>
          <Grid item xs={12} lg={12}>
            <VisitsChart onChartUpdate={onChartUpdate} />
          </Grid>
          <Grid item xs={12} lg={4}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <MapInfo onChartUpdate={onChartUpdate} />
              </Grid>
            </Grid>
          </Grid>
          <Grid item xs={12} lg={8}>
            <MapsCharts onChartUpdate={onChartUpdate} />
          </Grid>
          <Grid item xs={12} lg={8}>
            <ShopClicks onChartUpdate={onChartUpdate} />
          </Grid>
          <Grid item xs={12} lg={4}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <ShopInfo onChartUpdate={onChartUpdate} />
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </Box>
    </PageContainer>
  );
};

export default Dashboard;
