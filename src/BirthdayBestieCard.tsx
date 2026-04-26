import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import confetti from 'canvas-confetti'
import { useEffect, useMemo, useRef, useState } from 'react'

type Phase = 'candles' | 'message' | 'question' | 'final'

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min
}

function burstConfetti() {
  const colors = ['#a78bfa', '#f472b6', '#fb7185', '#22d3ee', '#fde68a']
  confetti({
    particleCount: 120,
    spread: 70,
    origin: { y: 0.7 },
    colors,
  })
  confetti({
    particleCount: 70,
    spread: 120,
    startVelocity: 38,
    origin: { y: 0.55 },
    colors,
  })
}

function heartPop() {
  const colors = ['#fb7185', '#f472b6', '#a78bfa', '#fecdd3']
  confetti({
    particleCount: 90,
    spread: 65,
    startVelocity: 28,
    gravity: 0.9,
    origin: { y: 0.65 },
    colors,
  })
}

export default function BirthdayBestieCard() {
  const prefersReducedMotion = useReducedMotion()

  const [phase, setPhase] = useState<Phase>('candles')
  const [isBlown, setIsBlown] = useState(false)
  const [hasMic, setHasMic] = useState<boolean | null>(null)
  const [listening, setListening] = useState(false)
  const [blowHint, setBlowHint] = useState('Blow into your mic… or tap to blow.')

  const [noAttempts, setNoAttempts] = useState(0)
  const [noPos, setNoPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [noScale, setNoScale] = useState(1)
  const [yesText, setYesText] = useState('Yes')
  const [finalHearts, setFinalHearts] = useState<
    Array<{ id: string; x: number; y: number; r: number; s: number }>
  >([])

  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const rafRef = useRef<number | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const blowScoreRef = useRef(0)

  const yesScale = useMemo(() => {
    const base = phase === 'question' ? 1.05 : 1
    return clamp(base + noAttempts * 0.35, 1, 2.6)
  }, [noAttempts, phase])

  const stopMic = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    analyserRef.current = null
    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close()
      } catch {
        // ignore
      }
      audioCtxRef.current = null
    }
    if (mediaStreamRef.current) {
      for (const t of mediaStreamRef.current.getTracks()) t.stop()
      mediaStreamRef.current = null
    }
    setListening(false)
  }

  const markBlown = () => {
    if (isBlown) return
    setIsBlown(true)
    setPhase('message')
    stopMic()
    if (!prefersReducedMotion) burstConfetti()
  }

  const startMic = async () => {
    if (listening || isBlown) return
    try {
      setBlowHint('Listening… blow steadily for a moment.')
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      })
      mediaStreamRef.current = stream

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new AudioCtx()
      audioCtxRef.current = ctx

      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.85
      source.connect(analyser)
      analyserRef.current = analyser

      setListening(true)
      setHasMic(true)

      const buf = new Uint8Array(analyser.fftSize)
      const tick = () => {
        const a = analyserRef.current
        if (!a) return
        a.getByteTimeDomainData(buf)

        let sum = 0
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128
          sum += v * v
        }
        const rms = Math.sqrt(sum / buf.length) // ~0..1

        // "Blow" tends to be sustained noise; build a score over time.
        // Threshold chosen to be forgiving across laptop mics.
        const hit = rms > 0.085 ? 1 : 0
        blowScoreRef.current = clamp(blowScoreRef.current * 0.92 + hit * 0.25, 0, 1.4)

        if (blowScoreRef.current > 1.0) {
          markBlown()
          return
        }

        rafRef.current = requestAnimationFrame(tick)
      }

      rafRef.current = requestAnimationFrame(tick)
    } catch {
      setHasMic(false)
      setBlowHint('No mic permission — tap the cake to blow the candles.')
      stopMic()
    }
  }

  useEffect(() => {
    return () => stopMic()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (phase !== 'candles') stopMic()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  const moveNo = () => {
    setNoAttempts((a) => a + 1)
    setYesText((t) => (t === 'Yes' ? 'YES!!!' : t))
    setNoScale((s) => clamp(s - 0.12, 0.55, 1))

    // Keep within a "safe box" near the buttons; random but bounded.
    const x = rand(-90, 90)
    const y = rand(-24, 42)
    setNoPos({ x, y })
  }

  const onClickYes = () => {
    setPhase('final')
    if (!prefersReducedMotion) {
      heartPop()
      burstConfetti()
    }

    const hearts = Array.from({ length: 18 }).map((_, i) => ({
      id: `${Date.now()}-${i}`,
      x: rand(10, 90),
      y: rand(55, 82),
      r: rand(-18, 18),
      s: rand(0.8, 1.35),
    }))
    setFinalHearts(hearts)
    window.setTimeout(() => setFinalHearts([]), 1600)
  }

  return (
    <div className="min-h-dvh w-full bg-gradient-to-br from-[#12081e] via-[#1a0b2e] to-[#090012] text-white">
      <style>{`
        @keyframes flameFlicker {
          0% { transform: translateY(0) scale(1) rotate(-2deg); opacity: .95; }
          35% { transform: translateY(-2px) scale(1.03) rotate(2deg); opacity: 1; }
          70% { transform: translateY(1px) scale(.98) rotate(-1deg); opacity: .9; }
          100% { transform: translateY(0) scale(1) rotate(1deg); opacity: .95; }
        }
        .flame-flicker { animation: flameFlicker .18s infinite ease-in-out; }
      `}</style>

      <div className="mx-auto flex min-h-dvh w-full max-w-5xl items-center justify-center px-4 py-10">
        <div className="relative w-full max-w-xl">
          <div className="absolute -inset-8 -z-10 rounded-[36px] bg-gradient-to-r from-fuchsia-500/20 via-violet-500/10 to-cyan-400/10 blur-2xl" />

          {/* Glassmorphism main card */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[28px] border border-white/15 bg-white/8 p-5 shadow-[0_30px_120px_-30px_rgba(255,255,255,0.25)] backdrop-blur-md sm:p-8"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium tracking-wide text-white/60">Virtual Birthday Card</p>
                <p className="text-sm font-semibold text-white/90">For dearest Trisha</p>
              </div>
              {phase === 'candles' && (
                <button
                  type="button"
                  onClick={() => (listening ? stopMic() : startMic())}
                  className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90 hover:bg-white/15 active:scale-[0.98]"
                >
                  {listening ? 'Stop mic' : 'Use mic'}
                </button>
              )}
            </div>

            <div className="mt-5">
              <AnimatePresence mode="wait">
                {phase === 'candles' && (
                  <motion.div
                    key="candles"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="space-y-4"
                  >
                    <div className="text-center">
                      <h1 className="text-balance bg-gradient-to-r from-fuchsia-200 via-pink-100 to-cyan-100 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent sm:text-4xl">
                        Make a wish…
                      </h1>
                      <p className="mt-2 text-sm text-white/70">{blowHint}</p>
                      {hasMic === false && (
                        <p className="mt-1 text-xs text-amber-200/90">
                          Tip: click/tap the cake to “blow” as a fallback.
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={markBlown}
                      onMouseEnter={() => {
                        if (hasMic === null) setBlowHint('Tap the cake (or enable mic) to blow out the candles.')
                      }}
                      className="group relative mx-auto block w-full max-w-sm rounded-2xl border border-white/15 bg-gradient-to-b from-white/10 to-white/5 p-4 text-left shadow-[0_20px_80px_-40px_rgba(0,0,0,0.6)] hover:bg-white/10 active:scale-[0.99]"
                      aria-label="Blow out candles"
                    >
                      {/* Cake */}
                      <div className="relative mx-auto h-[220px] w-full max-w-[320px]">
                        <div className="absolute bottom-0 left-1/2 h-[105px] w-[300px] -translate-x-1/2 rounded-[24px] bg-gradient-to-b from-[#ffb4d1] to-[#ff6aa9] shadow-[0_18px_40px_-18px_rgba(255,105,180,0.55)]" />
                        <div className="absolute bottom-[78px] left-1/2 h-[70px] w-[260px] -translate-x-1/2 rounded-[22px] bg-gradient-to-b from-[#ffd0e4] to-[#ff8bc0]" />
                        <div className="absolute bottom-[120px] left-1/2 h-[55px] w-[220px] -translate-x-1/2 rounded-[20px] bg-gradient-to-b from-[#ffe3ee] to-[#ffb7d3]" />

                        {/* Frosting drips */}
                        <div className="absolute bottom-[98px] left-1/2 h-[26px] w-[280px] -translate-x-1/2 rounded-[18px] bg-white/20 blur-[0.2px]" />
                        <div className="absolute bottom-[94px] left-1/2 flex w-[260px] -translate-x-1/2 justify-between px-3">
                          {Array.from({ length: 7 }).map((_, i) => (
                            <div
                              key={i}
                              className="h-[18px] w-[14px] rounded-b-full bg-white/18"
                              style={{ transform: `translateY(${(i % 3) * 3}px)` }}
                            />
                          ))}
                        </div>

                        {/* Candles */}
                        <div className="absolute bottom-[150px] left-1/2 flex -translate-x-1/2 items-end gap-6">
                          {[0, 1, 2].map((i) => (
                            <div key={i} className="relative flex flex-col items-center">
                              {/* Flame (separate div with flicker, toggles off when isBlown) */}
                              <AnimatePresence>
                                {!isBlown && (
                                  <motion.div
                                    initial={{ opacity: 0, y: 6, scale: 0.9 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.85 }}
                                    className="flame-flicker absolute -top-[34px] h-[30px] w-[18px]"
                                  >
                                    <div className="absolute inset-0 rounded-full bg-gradient-to-b from-[#fff7b1] via-[#ffd166] to-[#ff4d6d] blur-[0.2px]" />
                                    <div className="absolute left-1/2 top-1/2 h-[18px] w-[10px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/60 blur-[1px]" />
                                  </motion.div>
                                )}
                              </AnimatePresence>

                              {/* Candle body (3D-ish) */}
                              <div className="relative h-[56px] w-[16px] rounded-full bg-gradient-to-r from-white/60 via-white/20 to-white/50 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)]">
                                <div className="absolute left-[3px] top-[6px] h-[44px] w-[4px] rounded-full bg-fuchsia-300/70" />
                                <div className="absolute left-[8px] top-[10px] h-[40px] w-[2px] rounded-full bg-cyan-200/60" />
                              </div>
                              <div className="mt-[6px] h-[6px] w-[18px] rounded-full bg-black/20 blur-[0.2px]" />
                            </div>
                          ))}
                        </div>

                        {/* Plate */}
                        <div className="absolute bottom-[-8px] left-1/2 h-[40px] w-[340px] -translate-x-1/2 rounded-[999px] bg-gradient-to-b from-white/15 to-white/5 shadow-[0_20px_60px_-34px_rgba(34,211,238,0.35)]" />
                      </div>
                    </button>

                    <div className="flex items-center justify-center gap-2 text-center text-xs text-white/60">
                      <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-300/70" />
                      <span>Mic works best in Chrome/Edge. Tap fallback always works.</span>
                    </div>

                    <div className="text-center">
                      <button
                        type="button"
                        onClick={startMic}
                        className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/15 active:scale-[0.98]"
                      >
                        {listening ? 'Listening…' : 'Enable mic and blow'}
                      </button>
                    </div>
                  </motion.div>
                )}

                {phase !== 'candles' && (
                  <motion.div
                    key="after"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="space-y-5"
                  >
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center"
                    >
                      <motion.h2
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-balance bg-gradient-to-r from-amber-200 via-pink-200 to-violet-200 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent sm:text-4xl"
                      >
                        Happy Birthday!
                      </motion.h2>
                      <p className="mt-2 text-sm text-white/70">Today is officially a you-celebration.</p>
                    </motion.div>

                    {/* Heartfelt message container */}
                    <motion.div
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="rounded-2xl border border-white/12 bg-gradient-to-br from-white/12 via-white/8 to-white/6 p-5 text-left shadow-[0_18px_80px_-50px_rgba(0,0,0,0.7)]"
                    >
                      <p className="text-sm leading-relaxed text-white/90">
                        You’re the kind of friend who turns ordinary days into memories I replay when I need a smile,
                        Trisha. Thank you for the long hours calls, the ridiculous laughs, the “I’ve got you” moments,
                        and the calm you bring when everything feels loud.
                      </p>
                      <p className="mt-3 text-sm leading-relaxed text-white/90">
                        I hope this year spoils you with good surprises, soft mornings, and big wins. You deserve the
                        kind of happiness that doesn’t need a reason.
                      </p>
                      <p className="mt-3 text-sm font-semibold text-pink-100">
                        — Your forever-chaotic, forever-loyal friend💫
                      </p>
                    </motion.div>

                    {/* Trap question */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="rounded-2xl border border-white/12 bg-white/8 p-5"
                    >
                      <p className="text-center text-base font-semibold text-white/95">
                        Will you stay my <span className="text-pink-200">Best Friend</span> forever?
                      </p>

                      <div className="relative mt-4 flex items-center justify-center gap-3">
                        <motion.button
                          type="button"
                          onClick={onClickYes}
                          animate={{ scale: yesScale }}
                          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                          className="relative rounded-xl bg-gradient-to-r from-pink-500 to-violet-500 px-6 py-3 text-sm font-extrabold text-white shadow-[0_18px_50px_-20px_rgba(236,72,153,0.8)] focus:outline-none focus:ring-2 focus:ring-pink-200/70"
                        >
                          <span className="relative z-10">{yesText}</span>
                          <span className="absolute inset-0 rounded-xl bg-white/10 opacity-0 transition-opacity group-hover:opacity-100" />
                        </motion.button>

                        <motion.button
                          type="button"
                          onPointerEnter={moveNo}
                          onPointerDown={(e) => {
                            e.preventDefault()
                            moveNo()
                          }}
                          onClick={(e) => {
                            e.preventDefault()
                            moveNo()
                          }}
                          animate={{ x: noPos.x, y: noPos.y, scale: noScale, rotate: clamp(noPos.x / 10, -8, 8) }}
                          transition={{ type: 'spring', stiffness: 420, damping: 18 }}
                          className="rounded-xl border border-white/18 bg-white/7 px-6 py-3 text-sm font-bold text-white/85 shadow-[0_18px_55px_-30px_rgba(0,0,0,0.7)] hover:bg-white/10 active:scale-[0.98]"
                          style={{
                            touchAction: 'none',
                            userSelect: 'none',
                          }}
                          aria-label="No (but it will escape)"
                        >
                          No
                        </motion.button>
                      </div>

                      <p className="mt-3 text-center text-xs text-white/60">
                        (Try clicking “No”. I dare you.)
                      </p>
                    </motion.div>

                    {phase === 'final' && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-2xl border border-white/12 bg-gradient-to-br from-pink-500/15 via-violet-500/10 to-cyan-400/10 p-5 text-center"
                      >
                        <p className="text-xl font-extrabold text-white">Besties forever. Locked in.</p>
                        <p className="mt-1 text-sm text-white/70">Now go celebrate like the main character you are.</p>
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Floating heart burst overlay */}
          <AnimatePresence>
            {finalHearts.length > 0 && (
              <div className="pointer-events-none absolute inset-0">
                {finalHearts.map((h) => (
                  <motion.div
                    key={h.id}
                    initial={{ opacity: 0, scale: 0.6, x: `${h.x}%`, y: `${h.y}%` }}
                    animate={{ opacity: 1, scale: h.s, rotate: h.r, y: `${h.y - 35}%` }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 1.1, ease: 'easeOut' }}
                    className="absolute"
                  >
                    <div className="text-2xl drop-shadow-[0_10px_30px_rgba(236,72,153,0.65)]">💖</div>
                  </motion.div>
                ))}
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

