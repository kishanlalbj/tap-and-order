import { sql, type SQL } from "drizzle-orm";
import type { LatLng } from "./geo";

/** geography point for a lat/lng, for use in ST_DWithin / ST_Distance (metres). */
export const geog = ({ lat, lng }: LatLng): SQL =>
  sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography`;
