# assets/images

Drop project screenshots, a headshot, or an OG preview image here.

To use one in a project card, replace the gradient placeholder in `index.html`:

```html
<!-- before -->
<div class="card__thumb card__thumb--a" aria-hidden="true"></div>

<!-- after -->
<img class="card__thumb" src="assets/images/project-one.png"
     alt="Screenshot of Project One's dashboard" width="800" height="500">
```

Two habits worth keeping:

- **Always write a real `alt`.** Describe what the image shows, not "image of".
  Use `alt=""` only for purely decorative images.
- **Set `width` and `height`.** The browser reserves the right space before the
  file loads, so the page doesn't jump around as images arrive.
