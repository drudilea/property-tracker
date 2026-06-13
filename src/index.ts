import "dotenv/config";
import { scrape, closeBrowser } from "./scraper.js";
import { saveApartment } from "./notion.js";

const url = process.argv[2];

if (!url) {
  console.error("Usage: npx tsx src/index.ts <idealista-url>");
  console.error('Example: npx tsx src/index.ts "https://www.idealista.com/inmueble/12345678/"');
  process.exit(1);
}

if (!url.includes("idealista.com/inmueble/")) {
  console.error("Error: URL does not appear to be an idealista listing.");
  console.error("Expected format: https://www.idealista.com/inmueble/{ID}/");
  process.exit(1);
}

if (!process.env.NOTION_TOKEN || !process.env.NOTION_DATABASE_ID) {
  console.error("Error: Missing environment variables.");
  console.error("Set NOTION_TOKEN and NOTION_DATABASE_ID in .env");
  console.error("See .env.example for reference.");
  process.exit(1);
}

async function main() {
  console.log(`\nScraping: ${url}`);
  const apartment = await scrape(url);

  console.log(`\n✓ Data extracted:`);
  console.log(`  Title: ${apartment.title}`);
  console.log(`  Price: ${apartment.price ? apartment.price + "€/month" : "N/A"}`);
  console.log(`  Location: ${apartment.location}`);
  console.log(`  Rooms: ${apartment.rooms ?? "?"} | m²: ${apartment.squareMeters ?? "?"} | Floor: ${apartment.floor ?? "?"}`);
  console.log(`  Contact: ${apartment.contactName} ${apartment.contactPhone}`);
  console.log(`  Photos: ${apartment.photoUrls.length}`);

  console.log(`\nSaving to Notion...`);
  const result = await saveApartment(apartment);

  if (result.status === "created") {
    console.log(`\n✓ Apartment saved to Notion (${result.pageId})`);
  } else {
    console.log(`\n⚠ This apartment already exists in Notion (${result.pageId})`);
  }
}

main()
  .catch((err) => {
    console.error("\n✗ Error:", err.message);
    process.exitCode = 1;
  })
  .finally(() => closeBrowser());
