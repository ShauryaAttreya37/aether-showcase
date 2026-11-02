"""Tests for the forecast checks in build.py. Run: python3 -m unittest discover tests"""
import math
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from build import validate_forecast  # noqa: E402


def forecast(**changes):
    base = {
        "valid_from": "2025-10-02T00:00:00+00:00",
        "horizon_hours": [1, 2],
        "grid": {"size": 2},
        "model_kind": "gradient_boosted_field",
        "data_mode": "historical_hindcast",
        "warning": "demo",
        "pm25": [[[10.0, 20.0], [30.0, 40.0]], [[50.0, 60.0], [70.0, 80.0]]],
    }
    return {**base, **changes}


class ValidateForecast(unittest.TestCase):
    def test_accepts_a_well_formed_forecast(self):
        validate_forecast(forecast())

    def test_rejects_horizon_hours_that_is_not_a_list(self):
        with self.assertRaisesRegex(SystemExit, "horizon_hours"):
            validate_forecast(forecast(horizon_hours=72))

    def test_rejects_a_frame_count_that_does_not_match_the_horizons(self):
        with self.assertRaisesRegex(SystemExit, "horizon_hours"):
            validate_forecast(forecast(horizon_hours=[1, 2, 3]))

    def test_rejects_a_frame_of_the_wrong_shape(self):
        with self.assertRaisesRegex(SystemExit, "2 × 2"):
            validate_forecast(forecast(pm25=[[[10.0, 20.0]], [[50.0, 60.0], [70.0, 80.0]]]))

    def test_rejects_a_value_that_is_not_finite(self):
        with self.assertRaisesRegex(SystemExit, "finite"):
            validate_forecast(forecast(pm25=[[[math.nan, 20.0], [30.0, 40.0]], [[50.0, 60.0], [70.0, 80.0]]]))

    def test_rejects_a_value_that_does_not_fit_one_byte(self):
        with self.assertRaisesRegex(SystemExit, "one byte"):
            validate_forecast(forecast(pm25=[[[300.0, 20.0], [30.0, 40.0]], [[50.0, 60.0], [70.0, 80.0]]]))

    def test_rejects_a_missing_key(self):
        broken = forecast()
        del broken["model_kind"]
        with self.assertRaisesRegex(SystemExit, "model_kind"):
            validate_forecast(broken)


if __name__ == "__main__":
    unittest.main()
