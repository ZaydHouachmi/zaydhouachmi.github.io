# Zayd Houachmi: engineering portfolio

**Live site: [zaydhouachmi.github.io](https://zaydhouachmi.github.io)** · [Résumé (PDF)](https://zaydhouachmi.github.io/assets/Zayd-Houachmi-Resume.pdf)

The portfolio of a mechanical engineering co-op student at the University of Ottawa. It shows four projects with their numbers: SolidWorks design, Formula SAE aerodynamics in ANSYS CFD, wind-farm energy modelling, and a prototype built for the Ottawa Police.

## What's on it

- **Four case-study pages** (`work/`): each opens with a title block (client, dates, my role, tools), a row of key readings, then the write-up, figures and tests.
- **A live wake model.** The Jensen wake model from my internship tool, re-implemented in JavaScript on a canvas: turn the wind, change spacing and wake decay, and watch the farm's output and wake loss change.
- **A drawing-set design.** Each section is a numbered "sheet" with a title block. The blue theme is a blueprint; the light theme is drafting vellum. The choice is remembered.
- **A looping SolidWorks recording** of the visual-shield assembly, which pauses when off screen and respects reduced-motion settings.

## How it's built

No framework and no build step: hand-written HTML, one shared stylesheet (`assets/site.css`) and one script (`assets/site.js`). It deploys by pushing to `main`, through GitHub Pages.

- Responsive down to phone width, with no horizontal scrolling.
- Keyboard-accessible, with a skip link, visible focus states and meaningful alt text; animations are switched off for `prefers-reduced-motion`.
- Fonts from Google Fonts (Big Shoulders, Source Sans 3, IBM Plex Mono); everything else is local.
- Open Graph and structured data for link previews and search.

## Run it locally

```bash
python -m http.server 8000
# open http://localhost:8000
```

## Structure

| Path | What it is |
|---|---|
| `index.html` | Home: profile, projects, live model, experience, skills, contact |
| `work/` | The four case-study pages |
| `assets/site.css`, `assets/site.js` | Shared styles, theme toggle and the wake-model demo |
| `assets/` | Images, the SolidWorks clip and the résumé PDF |
| `404.html` | Custom not-found page |
