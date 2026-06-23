import { useCallback, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { saveFileBlob } from '../lib/datasetDownload'
import {
  defaultTargetStyle,
  exportReferences,
  formatBibliography,
  parseReferenceFile,
  type ExportFileFormat,
  type ParsedReferences,
} from '../lib/reference/referenceEngine'
import { formatFileFormatLabel, formatConfidenceLabel } from '../lib/reference/referenceFormatDetect'
import {
  REFERENCE_STYLE_GROUPS,
  findStyleById,
} from '../lib/reference/referenceStyles'

const ACCEPT = '.bib,.ris,.enw,.txt,.text,text/plain,application/x-bibtex'

export function ReferenceManagerPage() {
  const citeRef = useRef<ParsedReferences | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [fileName, setFileName] = useState('')
  const [entryCount, setEntryCount] = useState(0)
  const [detectedLabel, setDetectedLabel] = useState('')
  const [detectedConfidence, setDetectedConfidence] = useState('')
  const [fileFormatLabel, setFileFormatLabel] = useState('')
  const [targetStyleId, setTargetStyleId] = useState('apa')
  const [exportFormat, setExportFormat] = useState<ExportFileFormat>('txt')
  const [preview, setPreview] = useState('')
  const [loading, setLoading] = useState(false)
  const [converting, setConverting] = useState(false)
  const [parseNote, setParseNote] = useState('')
  const [error, setError] = useState('')

  const refreshPreview = useCallback(async (parsed: ParsedReferences, styleId: string) => {
    const style = findStyleById(styleId)
    if (!style) return
    const text = await formatBibliography(parsed.cite, style, 'text')
    setPreview(text)
  }, [])

  async function processFile(file: File) {
    setError('')
    setLoading(true)
    setPreview('')

    try {
      const text = await file.text()
      const parsed = await parseReferenceFile(text, file.name)
      citeRef.current = parsed

      const target = defaultTargetStyle(parsed.detected)
      setFileName(file.name)
      setEntryCount(parsed.count)
      setFileFormatLabel(formatFileFormatLabel(parsed.detected.fileFormat))
      setDetectedLabel(parsed.detected.styleLabel ?? 'Unknown')
      setDetectedConfidence(formatConfidenceLabel(parsed.detected.confidence))
      setTargetStyleId(target.id)
      setParseNote(parsed.parseNote ?? '')

      await refreshPreview(parsed, target.id)
    } catch (err) {
      citeRef.current = null
      setFileName('')
      setEntryCount(0)
      setPreview('')
      setParseNote('')
      setDetectedConfidence('')
      setError(err instanceof Error ? err.message : 'Could not parse reference file')
    } finally {
      setLoading(false)
    }
  }

  function handleFile(file: File) {
    const ext = file.name.split('.').pop()?.toLowerCase()
    const ok =
      ['bib', 'ris', 'enw', 'txt', 'text'].includes(ext ?? '') ||
      file.type.startsWith('text/') ||
      file.type.includes('bibtex')
    if (!ok) {
      setError('Upload BibTeX (.bib), RIS (.ris), EndNote (.enw), or plain text (.txt)')
      return
    }
    void processFile(file)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  async function handleStyleChange(styleId: string) {
    setTargetStyleId(styleId)
    if (!citeRef.current) return

    setConverting(true)
    setError('')
    try {
      await refreshPreview(citeRef.current, styleId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed')
    } finally {
      setConverting(false)
    }
  }

  async function handleDownload() {
    if (!citeRef.current) return
    const style = findStyleById(targetStyleId)
    if (!style) return

    setConverting(true)
    setError('')
    try {
      const { content, mimeType, extension } = await exportReferences(
        citeRef.current.cite,
        style,
        exportFormat,
      )
      const base = fileName.replace(/\.[^.]+$/, '') || 'references'
      const outName = `${base}-${style.id}.${extension}`
      saveFileBlob(new Blob([content], { type: mimeType }), outName)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setConverting(false)
    }
  }

  const hasReferences = entryCount > 0 && citeRef.current !== null

  return (
    <div className="reference-page">
      <header className="reference-header">
        <div className="reference-header__left">
          <Link to="/" className="reference-header__back">
            ← Services
          </Link>
          <h1 className="reference-header__title">Reference Manager</h1>
        </div>
      </header>

      <main className="reference-main">
        <section className="reference-upload">
          <div
            className="reference-dropzone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              className="reference-dropzone__input"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFile(file)
              }}
            />
            <div className="reference-dropzone__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            </div>
            <p className="reference-dropzone__label">
              {fileName ? `Loaded: ${fileName}` : 'Drop your reference file here'}
            </p>
            <p className="reference-dropzone__hint">
              Formatted reference list — auto-detects IEEE, APA, Vancouver, Nature, and 20+ other
              styles. Also accepts BibTeX (.bib), RIS (.ris), and EndNote (.enw).
            </p>
          </div>
        </section>

        {loading && (
          <div className="reference-alert reference-alert--info" role="status">
            Parsing references…
          </div>
        )}

        {error && (
          <div className="reference-alert" role="alert">
            {error}
          </div>
        )}

        {hasReferences && !loading && (
          <section className="reference-panel">
            <div className="reference-meta">
              <div className="reference-meta__item">
                <span className="reference-meta__label">Entries</span>
                <strong>{entryCount}</strong>
              </div>
              <div className="reference-meta__item">
                <span className="reference-meta__label">File format</span>
                <strong>{fileFormatLabel}</strong>
              </div>
              <div className="reference-meta__item">
                <span className="reference-meta__label">Detected style</span>
                <strong>
                  {detectedLabel}
                  {detectedConfidence ? ` (${detectedConfidence})` : ''}
                </strong>
              </div>
            </div>

            {parseNote && (
              <p className="reference-footnote reference-footnote--note">{parseNote}</p>
            )}

            <div className="reference-controls">
              <div className="reference-controls__field">
                <label className="reference-controls__label" htmlFor="target-style">
                  Convert to style
                </label>
                <select
                  id="target-style"
                  className="reference-controls__select"
                  value={targetStyleId}
                  onChange={(e) => void handleStyleChange(e.target.value)}
                  disabled={converting}
                >
                  {REFERENCE_STYLE_GROUPS.map((group) => (
                    <optgroup key={group.id} label={group.label}>
                      {group.styles.map((style) => (
                        <option key={style.id} value={style.id}>
                          {style.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div className="reference-controls__field">
                <label className="reference-controls__label" htmlFor="export-format">
                  Download as
                </label>
                <select
                  id="export-format"
                  className="reference-controls__select"
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value as ExportFileFormat)}
                  disabled={converting}
                >
                  <option value="txt">Formatted bibliography (.txt)</option>
                  <option value="bib">BibTeX (.bib)</option>
                  <option value="ris">RIS (.ris)</option>
                  <option value="html">HTML (.html)</option>
                </select>
              </div>

              <button
                type="button"
                className="btn btn--primary reference-controls__download"
                onClick={() => void handleDownload()}
                disabled={converting}
              >
                {converting ? (
                  <>
                    <span className="btn__spinner" aria-hidden="true" />
                    Converting…
                  </>
                ) : (
                  'Download'
                )}
              </button>
            </div>

            <div className="reference-preview">
              <h2 className="reference-preview__title">
                Preview — {findStyleById(targetStyleId)?.label ?? targetStyleId}
              </h2>
              <pre className="reference-preview__body">{preview || 'No preview available.'}</pre>
            </div>

            <p className="reference-footnote">
              We detect citation style from formatting patterns (IEEE, Vancouver, APA, Nature, ACS,
              etc.) and convert via CSL templates. DOIs enrich metadata via CrossRef; .bib / .ris
              files are most accurate.
            </p>
          </section>
        )}
      </main>
    </div>
  )
}
