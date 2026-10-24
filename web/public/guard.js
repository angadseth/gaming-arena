// Frame-buster: GitHub Pages cannot send frame-ancestors / X-Frame-Options,
// so refuse to render inside another site's frame (clickjacking).
if (window.top !== window.self) {
  document.documentElement.style.display = 'none'
  window.top.location = window.self.location.href
}
