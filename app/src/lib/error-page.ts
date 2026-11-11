export function renderNotFoundPage(): string {
  return `<!doctype html>
<html lang="es-AR">
  <head>
    <meta charset="utf-8" />
    <title>Esto no existe · Que Carajo Leer</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <style>
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: #F5F0EB; color: #0A0A0A; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; }
      h1 { font-size: 2.5rem; margin: 0; }
      h2 { font-size: 1.25rem; margin: 0.5rem 0; }
      p { color: #555; margin: 0 0 1.5rem; }
      a { display: inline-block; padding: 0.5rem 1rem; border-radius: 0.375rem; background: #0A0A0A; color: #fff; text-decoration: none; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>404</h1>
      <h2>Esto no existe</h2>
      <p>El link está roto o la página se movió.</p>
      <a href="/">Volver al inicio</a>
    </div>
  </body>
</html>`;
}

export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>This page didn't load</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: #fafafa; color: #111; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
      p { color: #4b5563; margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1rem; border-radius: 0.375rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: #111; color: #fff; }
      .secondary { background: #fff; color: #111; border-color: #d1d5db; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>This page didn't load</h1>
      <p>Something went wrong on our end. You can try refreshing or head back home.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Try again</button>
        <a class="secondary" href="/">Go home</a>
      </div>
    </div>
  </body>
</html>`;
}
