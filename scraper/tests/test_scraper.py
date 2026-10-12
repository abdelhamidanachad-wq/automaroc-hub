import unittest

from scraper.scraper import clean_text, infer_brand, infer_fuel, listing_id_from_url, parse_number, validate_target_url


class ScraperNormalizationTests(unittest.TestCase):
    def test_clean_text_collapses_whitespace(self):
        self.assertEqual(clean_text("  Volkswagen\n Golf   7 "), "Volkswagen Golf 7")

    def test_price_normalization(self):
        self.assertEqual(parse_number("145 000 DH"), 145000)
        self.assertEqual(parse_number("1.250.000 MAD"), 1250000)
        self.assertIsNone(parse_number("Prix à négocier"))

    def test_brand_and_fuel_inference(self):
        self.assertEqual(infer_brand("Volkswagen Golf 7 2.0 TDI"), "Volkswagen")
        self.assertEqual(infer_brand("Dacia Duster Prestige"), "Dacia")
        self.assertEqual(infer_fuel("Diesel, boîte manuelle"), "Diesel")
        self.assertEqual(infer_fuel("Hybride essence"), "Hybride")

    def test_target_url_validation(self):
        self.assertEqual(validate_target_url("https://www.avito.ma/fr/maroc/voitures_d_occasion"), "https://www.avito.ma/fr/maroc/voitures_d_occasion")
        for value in ("http://www.avito.ma/fr", "https://evil.example/", "https://www.avito.ma.evil.example/", "https://user:pass@www.avito.ma/fr"):
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    validate_target_url(value)

    def test_listing_id_from_url(self):
        self.assertEqual(listing_id_from_url("https://www.avito.ma/fr/voiture/golf-12345678.htm"), "12345678")
        self.assertIsNone(listing_id_from_url("https://www.avito.ma/fr/voiture/golf.html"))


if __name__ == "__main__":
    unittest.main()
