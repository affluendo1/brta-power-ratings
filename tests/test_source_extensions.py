import unittest
from scraper.sync_trols import collect_section_extras


class SourceExtensionsTests(unittest.TestCase):
    def test_disabled_collectors_leave_no_data(self):
        self.assertEqual(collect_section_extras({}), {})

    def test_collector_isolated_and_preserves_json(self):
        section = {"fixtures": []}
        def collect(snapshot, request_get):
            snapshot["fixtures"].append("local change")
            self.assertTrue(callable(request_get))
            return {"records": [{"value": "source data"}]}
        self.assertEqual(collect_section_extras(section, {"future": collect}),
                         {"future": {"records": [{"value": "source data"}]}})
        self.assertEqual(section, {"fixtures": []})
        self.assertEqual(collect_section_extras(section, {"future": lambda *_: None}), {})

    def test_invalid_extensions_fail_before_persistence(self):
        for name, value in [("", {}), ("future", []), ("future", {"value": float('nan')})]:
            with self.assertRaises(ValueError):
                collect_section_extras({}, {name: lambda *_, value=value: value})
