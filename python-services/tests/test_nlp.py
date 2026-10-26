import unittest

from app.models.runtime_intent import RuntimeIntentMLP
from app.sentiment import analyze_sentiment


class NlpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.classifier = RuntimeIntentMLP()

    def test_mlp_classifies_refund_request(self) -> None:
        result = self.classifier.predict("Please give me a refund for my order")
        self.assertEqual(result["label"], "refund_request")
        self.assertGreater(result["confidence"], 0.2)
        self.assertEqual(len(result["all_intents"]), 6)

    def test_mlp_returns_probabilities_that_sum_to_one(self) -> None:
        result = self.classifier.predict("Where is my order?")
        self.assertEqual(result["label"], "order_status")
        probabilities = [item["confidence"] for item in result["all_intents"]]
        self.assertAlmostEqual(sum(probabilities), 1.0, places=6)

    def test_sentiment_handles_positive_and_negative_messages(self) -> None:
        self.assertEqual(analyze_sentiment("Great service, thank you!")["label"], "positive")
        self.assertEqual(analyze_sentiment("My order is late and damaged")["label"], "negative")

    def test_negation_reverses_lexicon_polarity(self) -> None:
        self.assertEqual(analyze_sentiment("This is not good")["label"], "negative")
        self.assertEqual(analyze_sentiment("The delivery was not bad")["label"], "positive")


if __name__ == "__main__":
    unittest.main()
