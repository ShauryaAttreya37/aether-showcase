# Aether Smart Badge: project page

Source for **[shauryaattreya37.github.io/aether-showcase](https://shauryaattreya37.github.io/aether-showcase/)**, a one-page write-up of the Aether Smart Badge, designed and built by [Shaurya Attreya](https://github.com/ShauryaAttreya37).

The project's code, CAD and diagrams are in **[aether-smart-badge](https://github.com/ShauryaAttreya37/aether-smart-badge)**.

The code excerpts on the page are copied from that repository by `build.py`, so they match the source line for line. To rebuild after the source changes:

```bash
git clone https://github.com/ShauryaAttreya37/aether-smart-badge ../aether-smart-badge
python build.py ../aether-smart-badge
```

Edit `template.html`, not `index.html`.

`build.py` also copies the app's `config.mjs`, `dose.mjs` and `alerts.mjs` into `app-js/` and packs the cached forecast into `data/`, so the interactive sections run the shipped logic on the shipped data. Page code is in `js/` and `demos.css`. Run the tests with:

```bash
node --test tests/
python3 -m unittest discover tests
```

© 2026 Shaurya Attreya. MIT License.
