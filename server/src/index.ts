import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import { connectDB, closeDB } from "./db";
import stationDetailsRouter from "./routes/stationDetails";
import stationsMapRouter from "./routes/stationsMap";
import homeDataRouter from "./routes/homeData";

dotenv.config();

const app = express();
app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(morgan("dev"));

app.get("/dashboard", (_req, res) => {
  res.json({ status: "OK", server: "ALAB-PH SERVER" });
});

app.use("/api", stationDetailsRouter);
app.use("/api", stationsMapRouter);
app.use("/api", homeDataRouter);

const PORT = process.env.PORT || 4001;

async function start() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

start();

process.on("SIGINT", async () => {
  await closeDB();
  process.exit(0);
});

