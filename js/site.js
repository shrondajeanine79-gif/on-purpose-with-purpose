(function(){
  var b=document.querySelector('.menu-toggle'), n=document.getElementById('nav'), h=document.querySelector('.site-header');
  if(b&&n){
    b.addEventListener('click',function(){var o=n.classList.toggle('open');b.setAttribute('aria-expanded',o?'true':'false');b.textContent=o?'Close':'Menu';});
    n.addEventListener('click',function(e){if(e.target.tagName==='A'){n.classList.remove('open');b.setAttribute('aria-expanded','false');b.textContent='Menu';}});
  }
  if(h&&h.classList.contains('over')){
    var f=function(){ if(window.scrollY>90){h.classList.add('stuck');}else{h.classList.remove('stuck');} };
    window.addEventListener('scroll',f,{passive:true}); f();
  }
})();

/* Forms stay on the same page: nothing redirects away.
   - Free-guide signups (form.lead-form): sent in the background to FormSubmit; the thank-you
     and the guide download appear right where the form was.
   - Contact form (#contact-form): sent in the background; a confirmation shows under the button.
   If sending fails, a pre-filled email to you opens instead so nothing is lost. */
(function(){
  var EMAIL = 'shrondajeanine@on-purpose-with-purpose.org';
  var PDF = 'guide/8-Ways-to-Be-Good-to-Yourself.pdf';

  function send(form){
    var url = form.getAttribute('data-ajax');
    return fetch(url, { method: 'POST', headers: { 'Accept': 'application/json' }, body: new FormData(form) })
      .then(function(r){ if (!r.ok) { throw new Error('bad status'); } return r.json().catch(function(){ return {}; }); })
      .then(function(j){ if (j && (j.success === 'false' || j.success === false)) { throw new Error('rejected'); } });
  }
  function val(form, sel){ var el = form.querySelector(sel); return el ? el.value.trim() : ''; }
  function busy(form, on){
    var b = form.querySelector('button[type="submit"]');
    if (b) { b.disabled = on; if (on) { b.setAttribute('data-label', b.textContent); b.textContent = 'Sending...'; } else if (b.getAttribute('data-label')) { b.textContent = b.getAttribute('data-label'); } }
  }

  // ---- Free guide signups ----
  Array.prototype.forEach.call(document.querySelectorAll('form.lead-form'), function(form){
    form.addEventListener('submit', function(e){
      e.preventDefault();
      var name = val(form, '[name="name"]'), email = val(form, 'input[type="email"]');
      function done(){
        var box = document.createElement('div'); box.className = 'thanks';
        var h = document.createElement('h3'); h.textContent = name ? 'Thank you, ' + name + '!' : 'Thank you!';
        var p = document.createElement('p'); p.textContent = 'Your guide is ready. We also emailed you a copy of the link.';
        var a = document.createElement('a'); a.className = 'btn btn-primary'; a.href = PDF; a.setAttribute('download', '');
        a.textContent = 'Download 8 Ways to Be Good to Yourself';
        box.appendChild(h); box.appendChild(p); box.appendChild(a);
        form.parentNode.replaceChild(box, form);
      }
      busy(form, true);
      send(form).then(done).catch(function(){
        busy(form, false);
        var body = 'Please add me to your list and send the free guide.\n\nName: ' + name + '\nEmail: ' + email;
        window.location.href = 'mailto:' + EMAIL + '?subject=' + encodeURIComponent('Free guide request') + '&body=' + encodeURIComponent(body);
        done();
      });
    });
  });

  // ---- Contact form ----
  var cf = document.getElementById('contact-form');
  if (cf) {
    cf.addEventListener('submit', function(e){
      e.preventDefault();
      var status = document.getElementById('status');
      busy(cf, true);
      send(cf).then(function(){
        cf.reset(); busy(cf, false);
        if (status) { status.className = 'status-ok'; status.textContent = 'Thank you. Your message has been sent. Shronda will review it and respond as appropriate.'; }
      }).catch(function(){
        busy(cf, false);
        if (status) { status.className = 'status-err'; status.innerHTML = 'Sorry, your message did not send. Please email <a href="mailto:' + EMAIL + '">' + EMAIL + '</a> instead.'; }
      });
    });
  }
})();

/* highlight the menu link for the section you are viewing (stays on the same page) */
(function(){
  var links = document.querySelectorAll('.nav a.link[href^="#"]');
  if (!links.length || !('IntersectionObserver' in window)) return;
  var map = {};
  Array.prototype.forEach.call(links, function(a){ var id = a.getAttribute('href').slice(1); var el = document.getElementById(id); if (el) map[id] = {a:a, el:el}; });
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(en){
      if (!en.isIntersecting) return;
      Array.prototype.forEach.call(links, function(a){ a.removeAttribute('aria-current'); });
      var m = map[en.target.id]; if (m) m.a.setAttribute('aria-current', 'true');
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  Object.keys(map).forEach(function(id){ io.observe(map[id].el); });
})();
