import { sheets as googleSheets, sheets_v4 } from "@googleapis/sheets";
import { GoogleAuth, JWTInput } from "google-auth-library";

export function createClient(credentials: JWTInput): sheets_v4.Sheets {
  const auth = new GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return googleSheets({
    version: "v4",
    auth,
  });
}
