(function(){
  var b=document.querySelector('.menu-toggle'), n=document.getElementById('nav');
  if(!b||!n) return;
  b.addEventListener('click',function(){
    var open=n.classList.toggle('open');
    b.setAttribute('aria-expanded',open?'true':'false');
    b.textContent=open?'Close':'Menu';
  });
  n.addEventListener('click',function(e){ if(e.target.tagName==='A'){ n.classList.remove('open'); b.setAttribute('aria-expanded','false'); b.textContent='Menu'; }});
})();

/* Lead + contact forms: nothing redirects away.
   - form.lead-form: free-guide + newsletter signups. Sends in the background, then
     offers the guide PDF download in place. To change newsletter providers later
     (e.g. Buttondown embedded form), update the forms' data-ajax attribute only.
   - #contact-form: inline confirmation; on failure a pre-filled email opens so nothing is lost. */
(function(){
  var EMAIL='shrondajeanine@on-purpose-with-purpose.org';
  var PDF='guide/8-Ways-to-Be-Good-to-Yourself.pdf';
  function ajax(form){
    return fetch(form.getAttribute('data-ajax'),{method:'POST',headers:{'Accept':'application/json'},body:new FormData(form)})
      .then(function(r){ if(!r.ok) throw new Error('bad status'); return r.json().catch(function(){ return {}; }); })
      .then(function(j){ if(j&&(j.success==='false'||j.success===false)) throw new Error('rejected'); });
  }
  function busy(form,on){
    var btn=form.querySelector('button[type="submit"]'); if(!btn) return;
    if(on){ btn.dataset.label=btn.textContent; btn.disabled=true; btn.textContent='Sending...'; }
    else { btn.disabled=false; if(btn.dataset.label) btn.textContent=btn.dataset.label; }
  }
  var leads=document.querySelectorAll('form.lead-form');
  Array.prototype.forEach.call(leads,function(form){
    form.addEventListener('submit',function(e){
      e.preventDefault();
      var nameEl=form.querySelector('[name="name"]'), emailEl=form.querySelector('input[type="email"]');
      var name=nameEl?nameEl.value.trim():'';
      var done=function(){
        var box=document.createElement('div');
        box.className='lead-thanks'; box.setAttribute('role','status');
        box.style.cssText='padding:28px;border-radius:16px;background:#eaf2ef;color:#22291f;box-shadow:0 14px 36px rgba(41,43,50,.12)';
        var h=document.createElement('h3'); h.textContent=name?('Thank you, '+name+'!'):'Thank you!';
        var p=document.createElement('p'); p.textContent='Your guide is ready, and a copy is headed to your inbox.';
        var a=document.createElement('a'); a.className=form.dataset.thanksClass||'btn btn-primary';
        a.href=PDF; a.setAttribute('download','');
        a.textContent='Download 8 Ways to Be Good to Yourself';
        box.appendChild(h); box.appendChild(p); box.appendChild(a);
        form.parentNode.replaceChild(box,form);
      };
      busy(form,true);
      ajax(form).then(done).catch(function(){
        busy(form,false);
        var body='Please add me to your list and send the free guide.\n\nName: '+name+'\nEmail: '+(emailEl?emailEl.value.trim():'');
        window.location.href='mailto:'+EMAIL+'?subject='+encodeURIComponent('Free guide request')+'&body='+encodeURIComponent(body);
        done();
      });
    });
  });
  var cf=document.getElementById('contact-form');
  if(cf){
    cf.addEventListener('submit',function(e){
      e.preventDefault();
      var st=document.getElementById('status');
      busy(cf,true);
      ajax(cf).then(function(){
        cf.reset(); busy(cf,false);
        if(st){ st.className='status-ok'; st.textContent='Thank you. Your message has been sent. Shronda will review it and respond as appropriate.'; }
      }).catch(function(){
        busy(cf,false);
        if(st){ st.className='status-err'; st.innerHTML='Sorry, your message did not send. Please email <a href="mailto:'+EMAIL+'">'+EMAIL+'</a> instead.'; }
      });
    });
  }
})();
