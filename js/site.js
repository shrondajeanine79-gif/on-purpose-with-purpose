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
