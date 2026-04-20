const { useState } = React;

// ============ Shared ============
const IconSrc = {
  navy: '../../assets/icon_navy.png',
  cream: '../../assets/icon_cream.png',
};

function Logo({ color = '#0099f2', height = 24 }) {
  const [svg, setSvg] = React.useState('');
  React.useEffect(() => {
    fetch('../../assets/logo.svg').then(r => r.text()).then(t => {
      const d = document.createElement('div'); d.innerHTML = t;
      const s = d.querySelector('svg');
      s.setAttribute('height', height);
      s.removeAttribute('width');
      s.style.height = height + 'px';
      s.style.width = 'auto';
      s.querySelectorAll('path').forEach(p => p.setAttribute('fill', color));
      setSvg(s.outerHTML);
    });
  }, [color, height]);
  return <span dangerouslySetInnerHTML={{ __html: svg }} style={{ display:'inline-flex', alignItems:'center' }}/>;
}

// ============ Header ============
function Header({ cart, onNav, onOpenCart }) {
  return (
    <header style={{ position:'sticky', top:0, zIndex:10, background:'rgba(232,227,223,0.92)', backdropFilter:'blur(6px)', borderBottom:'1px solid rgba(0,85,127,.10)' }}>
      <div style={{ maxWidth:1440, margin:'0 auto', padding:'18px 32px', display:'grid', gridTemplateColumns:'1fr auto 1fr', alignItems:'center' }}>
        <nav style={{ display:'flex', gap:28, fontSize:14, fontWeight:500 }}>
          {['Anillos','Pendientes','Colgantes','Pulseras','Hombre'].map(c =>
            <a key={c} onClick={() => onNav('plp', c)} style={{ color:'#00557f', textDecoration:'none', cursor:'pointer' }}>{c}</a>
          )}
        </nav>
        <div onClick={() => onNav('home')} style={{ cursor:'pointer' }}><Logo height={22}/></div>
        <div style={{ display:'flex', justifyContent:'flex-end', gap:22, alignItems:'center', color:'#00557f', fontSize:13 }}>
          <span style={{ cursor:'pointer' }}>Buscar</span>
          <span style={{ cursor:'pointer' }} onClick={() => onNav('account')}>Cuenta</span>
          <span style={{ cursor:'pointer', position:'relative', fontWeight:600 }} onClick={onOpenCart}>
            Cesta
            {cart.length > 0 && <span style={{ marginLeft:6, display:'inline-grid', placeItems:'center', width:18, height:18, borderRadius:999, background:'#0099f2', color:'#fff', fontSize:10 }}>{cart.length}</span>}
          </span>
        </div>
      </div>
    </header>
  );
}

// ============ Hero ============
function Hero({ onNav }) {
  return (
    <section style={{ display:'grid', gridTemplateColumns:'1fr 1fr', minHeight:520, background:'#e8e3df' }}>
      <div style={{ padding:'96px 64px', display:'flex', flexDirection:'column', justifyContent:'center' }}>
        <div style={{ fontSize:11, letterSpacing:'.14em', textTransform:'uppercase', color:'#0099f2', fontWeight:700, marginBottom:18 }}>Reivindicando desde 1988</div>
        <h1 style={{ fontFamily:'var(--tq-font-display)', fontSize:72, fontWeight:700, color:'#00557f', lineHeight:1.02, margin:0, letterSpacing:'-0.01em' }}>
          Oro, plata y<br/>diamantes, para tod@s.
        </h1>
        <p style={{ maxWidth:460, marginTop:24, marginBottom:32, color:'#00557f', fontSize:17, lineHeight:1.55 }}>
          Lo accesible no es barato, es valioso. Una joyería para todas las personalidades, nacida en Tenerife.
        </p>
        <div style={{ display:'flex', gap:12 }}>
          <button onClick={() => onNav('plp','Novedades')} style={btn.primary}>Ver novedades</button>
          <button onClick={() => onNav('plp','Anillos')} style={btn.outline}>Anillos</button>
        </div>
      </div>
      <div style={{ background:'#00557f', position:'relative', overflow:'hidden' }}>
        <img src={IconSrc.cream} style={{ position:'absolute', bottom:-40, right:-40, width:'70%', opacity:.85 }}/>
        <div style={{ position:'absolute', top:32, right:40, color:'#e8e3df', fontSize:12, letterSpacing:'.14em', textTransform:'uppercase', fontWeight:700, opacity:.8 }}>17 tiendas en Tenerife</div>
      </div>
    </section>
  );
}

const btn = {
  primary: { fontFamily:'inherit', fontWeight:600, fontSize:14, letterSpacing:'.02em', padding:'14px 24px', borderRadius:8, border:'none', cursor:'pointer', background:'#0099f2', color:'#fff', transition:'background .2s' },
  outline: { fontFamily:'inherit', fontWeight:600, fontSize:14, letterSpacing:'.02em', padding:'14px 24px', borderRadius:8, cursor:'pointer', background:'transparent', color:'#00557f', border:'1.5px solid #00557f' },
  dark:    { fontFamily:'inherit', fontWeight:600, fontSize:14, letterSpacing:'.02em', padding:'14px 24px', borderRadius:8, border:'none', cursor:'pointer', background:'#00557f', color:'#e8e3df' },
  ghost:   { fontFamily:'inherit', fontWeight:500, fontSize:13, cursor:'pointer', background:'transparent', color:'#00557f', border:'none', padding:'6px 0' },
};

Object.assign(window, { Header, Hero, Logo, IconSrc, btn });
