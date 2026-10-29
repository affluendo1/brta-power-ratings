"""Check static dependencies without contacting external services."""
import json
import re
import unittest
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]

class FrontendPathsTests(unittest.TestCase):
    def test_shell_dependencies_exist_in_git(self):
        import subprocess
        existing = set(subprocess.check_output(['git', 'ls-files'], cwd=ROOT, text=True).splitlines())
        sw = (ROOT/'sw.js').read_text()
        shell = json.loads(re.search(r'const SHELL_FILES=(\[.*?\]);', sw).group(1))
        for ref in shell:
            name = ref.split('?')[0]
            if name == './': continue
            self.assertTrue((ROOT/name).is_file() or name in existing, name)
        for name in ['web/styles/site.css?v=80','web/styles/future.css?v=80','web/styles/style.css?v=80']:
            self.assertIn(name.split('?')[0],[ref.split('?')[0] for ref in shell])

    def test_stylesheet_relative_dependencies(self):
        import subprocess
        existing = set(subprocess.check_output(['git', 'ls-files'], cwd=ROOT, text=True).splitlines())
        for css in (ROOT/'web').rglob('*.css'):
            for url in re.findall(r'url\([\'"]?([^\)\'\"]+)', css.read_text()):
                if url.startswith(('data:', 'http', '#')): continue
                full=(css.parent/url.split('?')[0]).resolve()
                self.assertTrue(full.is_file() or str(full.relative_to(ROOT)) in existing, str(full))

    def test_worker_imports(self):
        worker=ROOT/'web/workers/rating-worker.js'
        for url in re.findall(r"'([^']+\.js[^']*)'",worker.read_text()):
            self.assertTrue((worker.parent/url.split('?')[0]).is_file(),url)

    def test_release_shell_revisions_match(self):
        sw = (ROOT / 'sw.js').read_text()
        shell = json.loads(re.search(r'const SHELL_FILES=(\[.*?\]);', sw).group(1))
        self.assertEqual(len(shell), len(set(shell)), 'Duplicate precache requests reject addAll')
        html = (ROOT / 'index.html').read_text()
        for ref in re.findall(r'(?:src|href)="([^"#]+)"', html):
            if not ref.startswith(('http', 'data:', '#')):
                self.assertIn(ref, shell, ref)
        for css in [ROOT/'web/styles/future.css', ROOT/'web/styles/style.css', ROOT/'web/optional/ambient.css']:
            for ref in re.findall(r'@import\s+url\([\'"]?([^\)\'\"]+)', css.read_text()):
                path, _, query = ref.partition('?')
                self.assertIn(str((css.parent / path).relative_to(ROOT)) + ('?' + query if query else ''), shell)
