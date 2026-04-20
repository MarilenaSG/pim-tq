function PDP({ product, onBack, onAdd }) {
  const [size, setSize] = React.useState('15');
  const [material, setMaterial] = React.useState(product.material);
  if (!product) return null;
  return (
    <section style={{ padding:'40px 32px 80px', maxWidth:1440, margin:'0 auto' }}>
      <div style={{ fontSize:12, color:'#00557f', opacity:.7, marginBottom:20, cursor:'pointer' }} onClick={onBack}>← Volver a {product.cat}</div>
      <div style={{ display:'grid', gridTemplateColumns:'1.3fr 1fr', gap:48 }}>
        <div style={{ background:'#f4f1ee', borderRadius:20, aspectRatio:'1/1.05', display:'grid', placeItems:'center' }}>
          <img src={IconSrc.navy} style={{ width:'45%', opacity:.35 }}/>
        </div>
        <div style={{ paddingTop:12 }}>
          <div style={{ fontSize:11, letterSpacing:'.14em', textTransform:'uppercase', color:'#0099f2', fontWeight:700, marginBottom:10 }}>{product.cat}</div>
          <h1 style={{ fontFamily:'var(--tq-font-display)', fontSize:40, fontWeight:700, color:'#00557f', margin:'0 0 10px', lineHeight:1.1 }}>{product.name}</h1>
          <div style={{ fontSize:22, fontWeight:600, color:'#00557f', fontVariantNumeric:'tabular-nums', marginBottom:4 }}>
            {product.price}
            {product.sale && <span style={{ color:'#b2b2b2', textDecoration:'line-through', marginLeft:10, fontWeight:400, fontSize:17 }}>{product.sale}</span>}
          </div>
          <div style={{ fontSize:12, color:'#00557f', opacity:.7, marginBottom:28 }}>Impuestos incluidos · envío calculado en la cesta</div>

          <div style={{ marginBottom:22 }}>
            <div style={{ fontSize:11, letterSpacing:'.14em', textTransform:'uppercase', color:'#00557f', fontWeight:700, marginBottom:10 }}>Material</div>
            <div style={{ display:'flex', gap:8 }}>
              {[product.material, 'Oro blanco 18k'].map(m => (
                <button key={m} onClick={()=>setMaterial(m)} style={{ ...btn.outline, padding:'10px 16px', fontSize:13, background: material===m?'#00557f':'transparent', color: material===m?'#e8e3df':'#00557f', borderColor:'#00557f' }}>{m}</button>
              ))}
            </div>
          </div>

          {product.cat === 'Anillos' && (
            <div style={{ marginBottom:22 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:10 }}>
                <div style={{ fontSize:11, letterSpacing:'.14em', textTransform:'uppercase', color:'#00557f', fontWeight:700 }}>Talla</div>
                <a style={{ fontSize:12, color:'#0099f2', textDecoration:'underline', cursor:'pointer' }}>Guía de tallas</a>
              </div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {['12','13','14','15','16','17','18','19','20'].map(s => (
                  <button key={s} onClick={()=>setSize(s)} style={{ width:44, height:44, borderRadius:8, border:'1.5px solid #00557f', background: size===s?'#00557f':'transparent', color: size===s?'#e8e3df':'#00557f', cursor:'pointer', fontWeight:600, fontSize:14 }}>{s}</button>
                ))}
              </div>
            </div>
          )}

          <div style={{ display:'flex', gap:10, marginTop:28 }}>
            <button style={{ ...btn.primary, flex:1, padding:'16px 24px', fontSize:15 }} onClick={()=>onAdd(product)}>Añadir a la cesta</button>
            <button style={{ ...btn.outline, padding:'16px 20px' }}>♡</button>
          </div>

          <div style={{ marginTop:32, paddingTop:24, borderTop:'1px solid rgba(0,85,127,.15)', fontSize:14, color:'#00557f', lineHeight:1.6 }}>
            <p style={{ margin:'0 0 12px' }}>Pieza hecha en nuestro taller de Santa Cruz, con oro de 18 quilates y acabado pulido. Cada anillo se entrega en estuche Te Quiero.</p>
            <p style={{ margin:0 }}>¿Tienes dudas? Pásate por una de nuestras <a style={{ color:'#0099f2' }}>17 tiendas</a> y te ayudamos.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function CartDrawer({ open, onClose, items, onRemove }) {
  const total = items.reduce((sum, p) => sum + parseFloat(p.price.replace('.','').replace(',','.').replace(' €','')), 0);
  return (
    <>
      {open && <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,32,60,.3)', zIndex:20 }}/>}
      <aside style={{ position:'fixed', top:0, right: open? 0 : -480, width:460, height:'100vh', background:'#e8e3df', zIndex:21, transition:'right .36s cubic-bezier(.4,0,.2,1)', boxShadow:'0 20px 40px rgba(0,32,60,.14)', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'22px 28px', borderBottom:'1px solid rgba(0,85,127,.12)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h3 style={{ fontFamily:'var(--tq-font-display)', fontSize:22, fontWeight:700, color:'#00557f', margin:0 }}>Tu cesta</h3>
          <span onClick={onClose} style={{ cursor:'pointer', fontSize:18, color:'#00557f' }}>✕</span>
        </div>
        <div style={{ flex:1, overflow:'auto', padding:'8px 28px' }}>
          {items.length === 0 && <div style={{ color:'#00557f', opacity:.7, fontSize:14, padding:'24px 0' }}>Tu cesta está vacía.</div>}
          {items.map((p,i) => (
            <div key={i} style={{ display:'grid', gridTemplateColumns:'64px 1fr auto', gap:12, padding:'16px 0', borderBottom:'1px solid rgba(0,85,127,.1)' }}>
              <div style={{ width:64, height:64, background:'#fff', borderRadius:10, display:'grid', placeItems:'center' }}>
                <img src={IconSrc.navy} style={{ width:'60%', opacity:.4 }}/>
              </div>
              <div>
                <div style={{ fontSize:11, letterSpacing:'.12em', textTransform:'uppercase', color:'#0099f2', fontWeight:700 }}>{p.cat}</div>
                <div style={{ fontSize:13, color:'#00557f', fontWeight:500 }}>{p.name}</div>
                <div style={{ fontSize:11, color:'#00557f', opacity:.7, marginTop:2 }}>{p.material}</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:14, fontWeight:600, color:'#00557f' }}>{p.price}</div>
                <button onClick={()=>onRemove(i)} style={{ ...btn.ghost, fontSize:11, marginTop:4 }}>Quitar</button>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding:'20px 28px', borderTop:'1px solid rgba(0,85,127,.15)', background:'#e8e3df' }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:14, color:'#00557f', marginBottom:4 }}>
            <span>Subtotal</span>
            <span style={{ fontWeight:600, fontVariantNumeric:'tabular-nums' }}>{total.toFixed(2).replace('.',',')} €</span>
          </div>
          <div style={{ fontSize:12, color:'#00557f', opacity:.7, marginBottom:14 }}>Envío gratis desde 60 €.</div>
          <button style={{ ...btn.primary, width:'100%', padding:'14px', fontSize:15 }} disabled={items.length===0}>Ir a pagar</button>
        </div>
      </aside>
    </>
  );
}

function Account() {
  return (
    <section style={{ padding:'80px 32px', maxWidth:520, margin:'0 auto' }}>
      <h1 style={{ fontFamily:'var(--tq-font-display)', fontSize:44, fontWeight:700, color:'#00557f', margin:'0 0 8px' }}>Hola de nuevo</h1>
      <p style={{ color:'#00557f', opacity:.7, fontSize:15, margin:'0 0 32px' }}>Accede a tu cuenta para ver tus pedidos y favoritos.</p>
      {[{l:'Email', v:'alba@example.com'}, {l:'Contraseña', v:'••••••••'}].map(f => (
        <div key={f.l} style={{ marginBottom:16 }}>
          <label style={{ display:'block', fontSize:11, letterSpacing:'.14em', textTransform:'uppercase', color:'#00557f', fontWeight:700, marginBottom:6 }}>{f.l}</label>
          <input defaultValue={f.v} style={{ width:'100%', fontFamily:'inherit', fontSize:15, padding:'14px 16px', borderRadius:8, border:'1px solid rgba(0,85,127,.25)', background:'#fff', color:'#00557f', boxSizing:'border-box', outline:'none' }}/>
        </div>
      ))}
      <button style={{ ...btn.primary, width:'100%', padding:'14px', fontSize:15, marginTop:12 }}>Entrar</button>
      <div style={{ textAlign:'center', marginTop:16 }}>
        <a style={{ color:'#0099f2', fontSize:13, cursor:'pointer' }}>¿Aún no tienes cuenta? Regístrate</a>
      </div>
    </section>
  );
}

Object.assign(window, { PDP, CartDrawer, Account });
