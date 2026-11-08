/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDownToLine, ArrowLeft, ArrowUpRight, Camera, CheckCheck, ChevronRight, Download, Expand, FileArchive, ImagePlus, Images, Layers2, LoaderCircle, LockKeyhole, Plus, RotateCcw, Share2, ShieldCheck, SlidersHorizontal, Sparkles, Trash2, X } from "lucide-react";
import { usePhotoEditor } from "@/hooks/use-photo-editor";
import { DEFAULT_SETTINGS, getWatermark } from "@/lib/image-processing";
import { PhotoPreview, type LogoPreview } from "./photo-preview";
import { CropControls } from "./crop-controls";
import { RangeControl } from "./range-control";

export function PhotoEditor() {
  const editor = usePhotoEditor();
  const fileInput = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [logo, setLogo] = useState<LogoPreview | null>(null);
  const [logoError, setLogoError] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [original, setOriginal] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const busy = editor.importing || editor.processing || editor.sharing;
  const prepared = editor.preparedFiles.length > 0;
  const activePhoto = editor.photos.find((photo) => photo.id === editor.activeId) ?? editor.photos[0];
  const photo = activePhoto ? { src: activePhoto.previewUrl, width: activePhoto.width, height: activePhoto.height, name: activePhoto.name } : { src: "/demo-mountains.jpg", width: 1600, height: 1067, name: "Paisagem de montanhas para demonstrar a marca d’água" };

  useEffect(() => {
    let mounted = true;
    getWatermark().then((canvas) => {
      if (mounted) setLogo({ url: canvas.toDataURL(), width: canvas.width, height: canvas.height });
    }).catch(() => { if (mounted) setLogoError(true); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (expanded) dialog.current?.showModal();
    else dialog.current?.close();
  }, [expanded]);

  const selectFiles = () => fileInput.current?.click();

  return <>
    <header className="site-header">
      <div className="header-inner">
        <Link href="/" className="brand" aria-label="Assina, início"><span className="brand-mark"><Layers2 size={23} strokeWidth={1.8} /></span><span>assina<span className="brand-dot">.</span></span><span className="brand-divider" /><span className="brand-caption">Um toque seu em cada foto.</span></Link>
        <div className="header-private"><LockKeyhole size={14} /><span>Suas fotos ficam com você</span></div>
      </div>
    </header>

    <main className="workspace">
      <section className="page-heading">
        <div><div className="studio-label"><span className="small-dot" /> Seu estúdio de assinaturas</div><h1>Boas fotos merecem<br className="mobile-break" /> a sua marca.</h1><p>Enquadre para o Instagram, aplique sua vinheta e compartilhe.</p></div>
        <div className="signature-credit"><span className="credit-avatar">AE</span><div><strong>AE Carvalho</strong><span>Assinatura FJU</span></div><CheckCheck size={18} /></div>
      </section>

      <div className="workflow" aria-label="Etapas"><span className="workflow-step current"><span>1</span> Adicione suas fotos</span><ChevronRight size={14}/><span className={`workflow-step ${editor.photos.length ? "current" : ""}`}><span>2</span> Escolha o corte</span><ChevronRight size={14}/><span className={`workflow-step ${prepared ? "current" : ""}`}><span>3</span> Baixe e compartilhe</span></div>

      {(editor.error || logoError) && <div className="error-message" role="alert"><span>{editor.error || "Não foi possível carregar a assinatura. Recarregue a página para tentar novamente."}</span>{editor.error && <button aria-label="Fechar aviso" className="icon-button" onClick={editor.dismissError}><X size={18}/></button>}</div>}

      <div className="editor-layout">
        <aside className="controls-column" aria-label="Fotos e ajustes">
          <section className="panel upload-panel">
            <div className="section-title"><span className="section-icon"><Images size={18}/></span><h2>Suas fotos</h2><span className="count-pill">{editor.photos.length.toString().padStart(2, "0")}</span></div>
            <input ref={fileInput} type="file" multiple accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" className="visually-hidden" tabIndex={-1} aria-label="Selecionar fotos" data-testid="photo-input" disabled={busy}
              onChange={(e) => { if (e.target.files) void editor.addFiles(Array.from(e.target.files)); e.target.value = ""; }} />
            <button className={`dropzone ${dragOver ? "drag-over" : ""}`} disabled={busy} onClick={selectFiles}
              onDragOver={(e) => { e.preventDefault(); if (!busy) setDragOver(true); }} onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); if (!busy) void editor.addFiles(Array.from(e.dataTransfer.files)); }}>
              <span className="upload-icon">{editor.importing ? <LoaderCircle size={25} className="spin" /> : <ImagePlus size={25} strokeWidth={1.6}/>}</span>
              <strong>{editor.importing ? "Preparando suas fotos…" : "Solte suas fotos aqui"}</strong><span>ou toque para escolher no aparelho</span><span className="upload-action"><Plus size={16}/> Selecionar fotos</span>
            </button>
            <div className="upload-details"><span>JPG, PNG ou WebP</span><span>Até 30 MB por foto</span></div>
          </section>

          <section className="panel settings-panel">
            <div className="section-title"><span className="section-icon"><SlidersHorizontal size={18}/></span><h2>Seu modelo</h2><button className="icon-button reset-button" title="Restaurar ajustes" aria-label="Restaurar ajustes" disabled={busy} onClick={() => editor.updateSettings(DEFAULT_SETTINGS)}><RotateCcw size={16}/></button></div>
            <div className="template-swatch"><div className="template-thumbnail">{logo && <img src={logo.url} alt="Modelo de vinheta AE Carvalho"/>}</div><div><strong>AE Carvalho / FJU</strong><span>{logoError ? "Modelo indisponível" : "Vinheta e assinatura originais"}</span><small>Marca com margem na base</small></div></div>
            <div className="position-control"><span className="position-symbol"><Camera size={20}/></span><div><span>Formato de publicação</span><strong>Instagram vertical · 4:5</strong></div><span className="output-size">1080 × 1350</span></div>
            <div className="sliders">
              <RangeControl label="Opacidade do modelo" value={editor.settings.opacity} min={10} max={100} description="Em 100%, preserva a vinheta exatamente como enviada." disabled={busy} onChange={(opacity) => editor.updateSettings({opacity})}/>
            </div>
            <div className="format-control"><label htmlFor="export-format">Formato de saída</label><select id="export-format" value={editor.settings.format} disabled={busy} onChange={(e) => editor.updateSettings({format: e.target.value as "image/jpeg" | "image/png"})}><option value="image/jpeg">JPG · alta qualidade</option><option value="image/png">PNG · sem perdas</option></select></div>
            <div className="apply-note"><CheckCheck size={15}/><span>Os ajustes valem para todas as fotos.</span></div>
          </section>
          <div className="privacy-note"><ShieldCheck size={20}/><p><strong>Seu álbum continua sendo seu.</strong>A edição acontece no aparelho. Você escolhe quando e com quem compartilhar.</p></div>
        </aside>

        <div className="preview-column">
          <section className="panel preview-panel" aria-label="Prévia da foto">
            <div className="preview-heading"><div><span className="section-icon"><Sparkles size={17}/></span><h2>Prévia</h2><span className="live-label"><span/> 4:5</span></div><button className="text-button" onClick={() => setExpanded(true)}><Expand size={15}/><span>Ampliar</span></button></div>
            <div className="photo-stage">
              <PhotoPreview key={activePhoto?.id ?? "demo"} {...photo} logo={logo} settings={editor.settings} original={original} framing={activePhoto?.framing} disabled={busy} onFramingChange={activePhoto ? (framing) => editor.updatePhotoFraming(activePhoto.id, framing) : undefined}/>
              {!activePhoto && <span className="demo-badge">Foto de demonstração</span>}
            </div>
            <div className="preview-toolbar"><div className="preview-filename"><span className="file-icon"><Images size={15}/></span><div><strong>{activePhoto ? activePhoto.name : "Pronta para o feed do Instagram."}</strong><span>Saída: 1080 × 1350 px{activePhoto ? ` · Original: ${activePhoto.width} × ${activePhoto.height}` : ""}</span></div></div><div className="view-toggle" aria-label="Comparação do modelo"><button onClick={() => setOriginal(true)} aria-pressed={original}>Sem modelo</button><button onClick={() => setOriginal(false)} aria-pressed={!original}>Com modelo</button></div></div>
            {activePhoto && <CropControls width={activePhoto.width} height={activePhoto.height} framing={activePhoto.framing} disabled={busy} onChange={(framing) => editor.updatePhotoFraming(activePhoto.id, framing)}/>}
          </section>

          <section className="gallery-section" aria-label="Fotos adicionadas">
            <div className="gallery-title"><h2>{editor.photos.length ? "Seu álbum" : "Tudo pronto para suas fotos"}<span>{editor.photos.length > 0 && `(${editor.photos.length})`}</span></h2>{editor.photos.length > 0 && <button className="text-button muted" disabled={busy} onClick={editor.clearPhotos}><Trash2 size={14}/> Limpar</button>}</div>
            {editor.photos.length ? <div className="photo-grid">{editor.photos.map((item, index) => <div className={`thumbnail-card ${activePhoto?.id === item.id ? "selected" : ""}`} key={item.id}>
              <button className="thumbnail-select" disabled={busy} onClick={() => editor.selectPhoto(item.id)} aria-label={`Visualizar ${item.name}`} aria-pressed={activePhoto?.id === item.id}><img src={item.previewUrl} alt="" loading="lazy"/><span className="thumbnail-number">{String(index + 1).padStart(2,"0")}</span>{activePhoto?.id === item.id && <span className="thumbnail-check"><CheckCheck size={12}/></span>}</button>
              <button className="thumbnail-remove" disabled={busy} aria-label={`Remover ${item.name}`} onClick={() => editor.removePhoto(item.id)}><X size={14}/></button><span className="thumbnail-name" title={item.name}>{item.name}</span>
            </div>)}<button className="add-more" disabled={busy} onClick={selectFiles}><Plus size={22}/><span>Adicionar</span></button></div> : <div className="gallery-empty"><span className="empty-icon"><Images size={24} strokeWidth={1.4}/></span><p>Um clique para selecionar.<br/><span>Uma assinatura em todas elas.</span></p><button className="icon-button" aria-label="Adicionar fotos ao álbum" onClick={selectFiles}><ArrowUpRight size={20}/></button></div>}
          </section>

          <section className={`export-panel ${prepared ? "export-ready" : ""}`} aria-label="Exportar fotos">
            <div className="export-top"><span className="export-icon">{prepared ? <CheckCheck size={23}/> : <FileArchive size={23}/>}</span><div className="export-description"><h2>{prepared ? "Suas fotos estão prontas!" : "Sua próxima publicação começa aqui."}</h2><p>{prepared ? `${editor.preparedFiles.length} ${editor.preparedFiles.length === 1 ? "foto pronta" : "fotos prontas"} para baixar ou compartilhar.` : editor.photos.length ? `${editor.photos.length} ${editor.photos.length === 1 ? "foto selecionada" : "fotos selecionadas"}, com corte e vinheta.` : "Fotos no formato do Instagram, com a sua assinatura."}</p></div></div>
            {editor.error && <p className="export-error">{editor.error}</p>}
            {editor.progress && <div className="progress-area" role="status" aria-live="polite"><div><span>{editor.progress.label}</span><span>{editor.progress.current}/{editor.progress.total}</span></div><progress max={editor.progress.total || 1} value={editor.progress.current}/></div>}
            {!prepared && <button className="primary-button export-button" disabled={busy || !editor.photos.length || !logo || logoError} onClick={() => void editor.prepareZip()}>{editor.processing ? <LoaderCircle size={19} className="spin"/> : <ArrowDownToLine size={19}/>}<span>{editor.processing ? "Preparando suas fotos…" : "Preparar fotos"}</span></button>}
            {prepared && <div className="export-actions"><button className="primary-button share-button" disabled={busy || Boolean(editor.shareUnavailableReason)} onClick={() => void editor.sharePhotos()}>{editor.sharing ? <LoaderCircle size={19} className="spin"/> : <Share2 size={19}/>}Compartilhar fotos</button><button className="secondary-button" disabled={busy || !editor.preparedZip} onClick={editor.downloadZip}><Download size={18}/>Baixar ZIP</button></div>}
            {prepared && !editor.preparedZip && !editor.processing && <button className="text-button" disabled={busy} onClick={() => void editor.retryZip()}>Tentar preparar o ZIP novamente</button>}
            {prepared && <p className="share-hint">{editor.shareUnavailableReason ?? "Escolha o WhatsApp no menu do celular. As imagens serão compartilhadas separadamente, sem ZIP."}</p>}
            {editor.shareStatus && <p className="share-status" role="status">{editor.shareStatus}</p>}
            <p className="export-footnote"><ShieldCheck size={13}/> Seus arquivos originais permanecem intactos.</p>
          </section>
        </div>
      </div>
      <footer className="site-footer"><span>Feito para guardar momentos. E deixar sua marca.</span><span className="footer-brand">assina<span>.</span></span></footer>
    </main>

    <dialog ref={dialog} className="preview-dialog" onClose={() => setExpanded(false)} onClick={(e) => { if (e.target === e.currentTarget) setExpanded(false); }} aria-label="Prévia ampliada">
      <div className="dialog-header"><div><strong>{activePhoto?.name ?? "Foto de demonstração"}</strong><span>{original ? "Corte sem o modelo" : "Instagram 4:5 · Vinheta e assinatura"}</span></div><button className="icon-button" aria-label="Fechar prévia ampliada" onClick={() => setExpanded(false)}><X size={23}/></button></div><div className="photo-stage dialog-stage"><PhotoPreview key={activePhoto?.id ?? "demo"} {...photo} logo={logo} settings={editor.settings} original={original} framing={activePhoto?.framing} disabled={busy} onFramingChange={activePhoto ? (framing) => editor.updatePhotoFraming(activePhoto.id, framing) : undefined}/></div><div className="dialog-footer"><button className="text-button" onClick={() => setExpanded(false)}><ArrowLeft size={16}/> Voltar aos ajustes</button><button className="text-button" onClick={() => setOriginal(!original)}>{original ? "Mostrar com modelo" : "Mostrar sem modelo"}</button></div>
    </dialog>
  </>;
}
