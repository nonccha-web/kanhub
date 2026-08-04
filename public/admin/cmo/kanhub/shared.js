/* ===== KAN HUB — shared scripts ===== */
// ---- Build navigation (9 main items; "บริการ" has a dropdown) ----
(function(){
  var NAV=[
    {label:'หน้าแรก',href:'index.html'},
    {label:'สินค้า',href:'catalog.html'},
    {label:'บริการ',href:'service.html',children:[
      {label:'บริการเสริม · จัดก้อนสด',href:'service.html'},
      {label:'เปิดร้าน-เปิดโกดัง',href:'consult.html'},
      {label:'ไลฟ์เปิดกระสอบ',href:'live.html'}
    ]},
    {label:'ทำไมต้อง KAN',href:'about.html'},
    {label:'ขายส่งทั่วไทย',href:'south.html'},
    {label:'วิธีสั่งซื้อ',href:'how-to-order.html'},
    {label:'FAQ',href:'faq.html'},
    {label:'บทความ',href:'blog.html'},
    {label:'ติดต่อ',href:'contact.html'}
  ];
  var SERVICE=['service.html','consult.html','live.html'];
  var path=location.pathname.split('/').pop()||'index.html';
  if(path==='')path='index.html';
  function link(href,label,cls){var a=document.createElement('a');a.href=href;a.textContent=label;if(cls)a.className=cls;if(href===path)a.classList.add('active');return a;}
  var menu=document.getElementById('navmenu');
  if(menu){NAV.forEach(function(it){
    if(it.children){
      var w=document.createElement('div');w.className='has-drop';
      var top=document.createElement('a');top.href=it.href;top.className='drop-top';
      top.innerHTML=it.label+' <span class="caret">▾</span>';
      if(SERVICE.indexOf(path)>-1)top.classList.add('active');
      w.appendChild(top);
      var dd=document.createElement('div');dd.className='dropdown';
      it.children.forEach(function(c){dd.appendChild(link(c.href,c.label));});
      w.appendChild(dd);menu.appendChild(w);
    }else{menu.appendChild(link(it.href,it.label));}
  });}
  var mob=document.getElementById('navmobile');
  if(mob){NAV.forEach(function(it){
    if(it.children){
      var g=document.createElement('div');g.className='m-group';g.textContent=it.label;mob.appendChild(g);
      it.children.forEach(function(c){mob.appendChild(link(c.href,c.label,'m-sub'));});
    }else{mob.appendChild(link(it.href,it.label));}
  });}
})();
// ---- Embed real Google Map into every .map placeholder ----
(function(){
  // โกดัง KAN HUB (พิกัดตัวอย่าง: เมืองสุราษฎร์ธานี) — เปลี่ยน q= เป็นพิกัดจริงได้
  var SRC='https://maps.google.com/maps?q=9.1382,99.3215&z=13&hl=th&output=embed';
  document.querySelectorAll('.map').forEach(function(el){
    el.classList.add('has-embed');
    el.innerHTML='<iframe loading="lazy" title="แผนที่โกดัง KAN HUB สุราษฎร์ธานี" '+
      'referrerpolicy="no-referrer-when-downgrade" src="'+SRC+'"></iframe>';
  });
})();
// mobile menu toggle
document.addEventListener('click',function(e){
  if(e.target.closest('.hamb')){
    var m=document.querySelector('.mobile-menu');
    if(m)m.classList.toggle('open');
  }
});
// FAQ accordion
document.querySelectorAll('.qa button').forEach(function(b){
  b.addEventListener('click',function(){b.parentElement.classList.toggle('open');});
});
// Hero slideshow (homepage)
(function(){
  var slides=document.querySelectorAll('#slides .slide');
  if(!slides.length)return;
  var dots=document.querySelectorAll('#dots b');var i=0;
  function go(n){
    slides[i].classList.remove('active');if(dots[i])dots[i].classList.remove('on');
    i=(n+slides.length)%slides.length;
    slides[i].classList.add('active');if(dots[i])dots[i].classList.add('on');
  }
  dots.forEach(function(d,n){d.addEventListener('click',function(){go(n);});});
  setInterval(function(){go(i+1);},4500);
})();
// Countdown
(function(){
  var d=document.querySelector('[data-d]');if(!d)return;
  var h=document.querySelector('[data-h]'),m=document.querySelector('[data-m]'),s=document.querySelector('[data-s]');
  var t=2*86400+8*3600+45*60+30;
  function p(n){return String(n).padStart(2,'0');}
  setInterval(function(){
    if(t<=0)return;t--;
    d.textContent=p(Math.floor(t/86400));h.textContent=p(Math.floor(t%86400/3600));
    m.textContent=p(Math.floor(t%3600/60));s.textContent=p(t%60);
  },1000);
})();
// จัดก้อนสด % selector (service page)
(function(){
  var box=document.getElementById('mixer');if(!box)return;
  var rows=box.querySelectorAll('input[type=range]');
  var total=document.getElementById('mixTotal');
  function upd(){
    var sum=0;rows.forEach(function(r){sum+=parseInt(r.value);r.nextElementSibling.textContent=r.value+'%';});
    total.textContent=sum+'%';
    total.style.color = sum===100 ? 'var(--green)' : (sum>100?'var(--crimson)':'var(--muted)');
  }
  rows.forEach(function(r){r.addEventListener('input',upd);});upd();
})();
