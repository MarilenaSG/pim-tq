const PRODUCTS = [
  { id:'r1', cat:'Anillos',    name:'Solitario clásico, oro 18k',     price:'349,00 €', material:'Oro 18k', sale:null },
  { id:'r2', cat:'Anillos',    name:'Aro trenzado, oro amarillo',     price:'219,00 €', material:'Oro 18k', sale:null },
  { id:'p1', cat:'Pendientes', name:'Aros pequeños, plata 925',       price:'59,00 €',  material:'Plata 925', sale:'79,00 €' },
  { id:'p2', cat:'Pendientes', name:'Pendiente perla, plata',         price:'89,00 €',  material:'Plata 925', sale:null },
  { id:'c1', cat:'Colgantes',  name:'Corazón infinito, oro',          price:'219,00 €', material:'Oro 18k', sale:null },
  { id:'c2', cat:'Colgantes',  name:'Gargantilla fina, plata',        price:'79,00 €',  material:'Plata 925', sale:null },
  { id:'b1', cat:'Pulseras',   name:'Pulsera de eslabones, plata',    price:'99,00 €',  material:'Plata 925', sale:null },
  { id:'b2', cat:'Pulseras',   name:'Esclava con diamante',           price:'489,00 €', material:'Oro 18k · diamante', sale:null },
];

function ProductCard({ p, onOpen }) {
  const [hover, setHover] = React.useState(false);
  return (
    <article onClick={() => onOpen(p)}
      onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}
      style={{ background:'#fff', borderRadius:14, overflow:'hidden', cursor:'pointer',
               boxShadow: hover ? '0 8px 20px rgba(0,32,60,.10)' : '0 2px 6px rgba(0,32,60,.08)',
               transition:'box-shadow .2s' }}>
      <div style={{ aspectRatio:'1', background:'#f4f1ee', display:'grid', placeItems:'center', overflow:'hidden' }}>
        <img src={IconSrc.navy} style={{ width:'45%', opacity:.35, transform: hover?'scale(1.03)':'scale(1)', transition:'transform .36s cubic-bezier(.4,0,.2,1)' }}/>
      </div>
      <div style={{ padding:'14px 16px 16px' }}>
        <div style={{ fontSize:10, letterSpacing:'.14em', textTransform:'uppercase', color:'#0099f2', fontWeight:700 }}>{p.cat}</div>
        <div style={{ fontSize:14, fontWeight:500, color:'#00557f', margin:'6px 0 8px', lineHeight:1.3 }}>{p.name}</div>
        <div style={{ fontSize:15, fontWeight:600, color:'#00557f', fontVariantNumeric:'tabular-nums' }}>
          {p.price}
          {p.sale && <span style={{ color:'#b2b2b2', textDecoration:'line-through', marginLeft:8, fontWeight:400, fontSize:13 }}>{p.sale}</span>}
        </div>
      </div>
    </article>
  );
}

function CategoryStrip({ onNav }) {
  const cats = [
    { name:'Anillos',    tag:'desde 69 €' },
    { name:'Pendientes', tag:'aros & perlas' },
    { name:'Colgantes',  tag:'con y sin inicial' },
    { name:'Hombre',     tag:'cadenas & sellos' },
  ];
  return (
    <section style={{ padding:'80px 32px', maxWidth:1440, margin:'0 auto' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:32 }}>
        <h2 style={{ fontFamily:'var(--tq-font-display)', fontSize:40, fontWeight:700, color:'#00557f', margin:0 }}>Explorar por categoría</h2>
        <a style={{ color:'#0099f2', fontSize:13, fontWeight:600, textDecoration:'none', cursor:'pointer' }}>Ver todo →</a>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:20 }}>
        {cats.map((c,i) => (
          <div key={c.name} onClick={() => onNav('plp', c.name)} style={{ cursor:'pointer', background:i%2? '#00557f':'#e8e3df', color: i%2? '#e8e3df':'#00557f', padding:'28px 24px 24px', borderRadius:16, minHeight:220, display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
            <img src={i%2?IconSrc.cream:IconSrc.navy} style={{ width:60, opacity: i%2? .8:.5, alignSelf:'flex-end' }}/>
            <div>
              <div style={{ fontSize:10, letterSpacing:'.14em', textTransform:'uppercase', fontWeight:700, opacity:.8 }}>{c.tag}</div>
              <div style={{ fontFamily:'var(--tq-font-display)', fontSize:26, fontWeight:700, marginTop:4 }}>{c.name}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProductGrid({ items, onOpen, title }) {
  return (
    <section style={{ padding:'40px 32px 80px', maxWidth:1440, margin:'0 auto' }}>
      {title && <h2 style={{ fontFamily:'var(--tq-font-display)', fontSize:36, fontWeight:700, color:'#00557f', margin:'0 0 28px' }}>{title}</h2>}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:20 }}>
        {items.map(p => <ProductCard key={p.id} p={p} onOpen={onOpen}/>)}
      </div>
    </section>
  );
}

function PatternBand() {
  return (
    <section style={{ background:`url(../../assets/pattern_full.png) center/cover`, height:240, display:'grid', placeItems:'center' }}>
      <div style={{ background:'#e8e3df', padding:'18px 42px', borderRadius:999, fontFamily:'var(--tq-font-display)', fontSize:22, fontWeight:700, color:'#00557f', fontStyle:'italic' }}>
        Reivindicando el valor de lo accesible desde 1988
      </div>
    </section>
  );
}

function TrustRow() {
  const items = [
    ['17 tiendas', 'en toda Tenerife'],
    ['Envío gratis', 'desde 60 € a toda España'],
    ['Cambios fáciles', '30 días, sin preguntas'],
    ['Pago seguro', 'Visa · MC · Bizum · a plazos'],
  ];
  return (
    <section style={{ padding:'48px 32px', maxWidth:1440, margin:'0 auto', display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:24 }}>
      {items.map(([h,s]) => (
        <div key={h}>
          <div style={{ fontFamily:'var(--tq-font-display)', fontSize:20, fontWeight:700, color:'#00557f' }}>{h}</div>
          <div style={{ fontSize:13, color:'#00557f', opacity:.7, marginTop:4 }}>{s}</div>
        </div>
      ))}
    </section>
  );
}

function Footer() {
  return (
    <footer style={{ background:'#00557f', color:'#e8e3df', padding:'64px 32px 40px' }}>
      <div style={{ maxWidth:1440, margin:'0 auto', display:'grid', gridTemplateColumns:'1.2fr 1fr 1fr 1fr', gap:32 }}>
        <div>
          <div style={{ marginBottom:16 }}><Logo color="#e8e3df" height={28}/></div>
          <p style={{ fontSize:13, lineHeight:1.6, opacity:.8, maxWidth:340 }}>
            Una joyería nacida en Tenerife en 1988. Oro, plata y diamantes accesibles para tod@s.
          </p>
        </div>
        {[
          ['Tienda', ['Anillos','Pendientes','Colgantes','Pulseras','Hombre']],
          ['Ayuda',  ['Envíos y devoluciones','Guía de tallas','Cuidado de joyas','Contacto']],
          ['Nosotros', ['Nuestra historia','17 tiendas','Taller propio','Prensa']],
        ].map(([h, items]) => (
          <div key={h}>
            <div style={{ fontSize:11, letterSpacing:'.14em', textTransform:'uppercase', fontWeight:700, marginBottom:14, opacity:.9 }}>{h}</div>
            {items.map(i => <div key={i} style={{ fontSize:13, padding:'4px 0', opacity:.85, cursor:'pointer' }}>{i}</div>)}
          </div>
        ))}
      </div>
      <div style={{ maxWidth:1440, margin:'40px auto 0', paddingTop:24, borderTop:'1px solid rgba(232,227,223,.2)', display:'flex', justifyContent:'space-between', fontSize:12, opacity:.7 }}>
        <span>© 2026 Te Quiero Joyerías · Tenerife</span>
        <span>Reivindicando el valor de lo accesible desde 1988</span>
      </div>
    </footer>
  );
}

Object.assign(window, { PRODUCTS, ProductCard, ProductGrid, CategoryStrip, PatternBand, TrustRow, Footer });
