import { useEffect, useRef, useState } from 'react'

function utcParts(date) {
  const p = (n) => String(n).padStart(2, '0')
  return {
    iso: date.toISOString(),
    date: `${date.getUTCFullYear()}-${p(date.getUTCMonth() + 1)}-${p(date.getUTCDate())}`,
    time: `${p(date.getUTCHours())}:${p(date.getUTCMinutes())}:${p(date.getUTCSeconds())}`,
  }
}

/**
 * Zulu readout for the footer. Ticks only while on screen so it costs nothing
 * while the WebGL globe owns the viewport.
 */
export default function FooterClock() {
  const ref = useRef(null)
  const [now, setNow] = useState(() => utcParts(new Date()))

  useEffect(() => {
    const node = ref.current
    if (!node) return

    let timer = null
    const stop = () => {
      if (timer) window.clearInterval(timer)
      timer = null
    }
    const start = () => {
      if (timer) return
      setNow(utcParts(new Date()))
      timer = window.setInterval(() => setNow(utcParts(new Date())), 1000)
    }

    const observer = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting ? start() : stop()),
      { threshold: 0 },
    )
    observer.observe(node)

    const onVisibility = () => {
      if (document.hidden) stop()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      stop()
    }
  }, [])

  return (
    <p ref={ref} className="atlas-footer__clock">
      <time dateTime={now.iso}>
        {now.date} <span className="atlas-footer__clock-time">{now.time}</span> UTC
      </time>
    </p>
  )
}
