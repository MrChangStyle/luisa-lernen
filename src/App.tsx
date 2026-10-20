import { useState } from 'react'
import { SAMPLE_LESSON } from './data/sampleLesson'
import type { CheckResult } from './logic/check'
import { addEgg } from './logic/farm'
import { dayKey, moodText } from './logic/mood'
import { Family, PinGate } from './screens/Family'
import { FarmScreen } from './screens/Farm'
import { Home } from './screens/Home'
import { Camera, Confirm, Done, StepScreen } from './screens/Learn'
import { OpenScreen, PhotosScreen, PracticeMenu, SelectionScreen, SubjectScreen } from './screens/Practice'
import { clock, useSaved, withEvent, type Attempt } from './state'
import { VERSION_LABEL, type Lesson } from './types'

const LESSONS: Record<string, Lesson> = { [SAMPLE_LESSON.id]: SAMPLE_LESSON }

type ScreenName =
  | 'home'
  | 'camera'
  | 'confirm'
  | 'step'
  | 'done'
  | 'practice'
  | 'subject'
  | 'selection'
  | 'open'
  | 'photos'
  | 'farm'
  | 'pin'
  | 'family'

export default function App() {
  const [saved, setSaved] = useSaved()
  const [screen, setScreen] = useState<ScreenName>('home')
  const [mood, setMood] = useState(() => saved.mood[dayKey(new Date())]?.value ?? 50)
  const [moodTouched, setMoodTouched] = useState(false)
  const [subject, setSubject] = useState('Mathe')
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [stepIndex, setStepIndex] = useState(0)
  const [version, setVersion] = useState(0)
  const [result, setResult] = useState<CheckResult | null>(null)
  const [reward, setReward] = useState<string[]>([])

  const lesson = SAMPLE_LESSON
  const today = dayKey(new Date())
  const todayMood = saved.mood[today]

  // Stimmung wird einmal pro Tag gespeichert, sobald Luisa nach dem Einstellen mit dem Lernen anfängt
  const saveMoodIfNeeded = () => {
    if (!moodTouched || todayMood) return
    const at = new Date().toISOString()
    setSaved((s) => withEvent({ ...s, mood: { ...s.mood, [today]: { value: mood, at } } }, `Stimmung des Tages gespeichert: „${moodText(mood)}“`))
  }

  const updateAttempt = (fn: (a: Attempt) => Attempt) =>
    setSaved((s) => ({ ...s, attempts: s.attempts.map((a) => (a.id === attemptId ? fn(a) : a)) }))

  const updateStat = (fn: (st: Attempt['stats'][number]) => Attempt['stats'][number]) =>
    updateAttempt((a) => ({ ...a, stats: a.stats.map((st, i) => (i === stepIndex ? fn(st) : st)) }))

  const startLesson = (l: Lesson, how: string) => {
    const id = crypto.randomUUID()
    const attempt: Attempt = {
      id,
      lessonId: l.id,
      subject: l.subject,
      topic: l.topic,
      source: l.source,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      stats: l.steps.map(() => ({ again: 0, wrong: [], helped: null })),
    }
    setSaved((s) => withEvent({ ...s, attempts: [...s.attempts, attempt].slice(-100) }, `${how}: ${l.subject}, ${l.topic}`))
    setAttemptId(id)
    setStepIndex(0)
    setVersion(0)
    setResult(null)
    setScreen('step')
  }

  const onResult = (r: CheckResult) => {
    setResult(r)
    const v = lesson.steps[stepIndex].versions[version].key
    if (r.status === 'ok') {
      updateStat((st) => ({ ...st, helped: v }))
      setSaved((s) => withEvent(s, `Schritt ${stepIndex + 1}: Eingabe passt (Erklärung „${VERSION_LABEL[v]}“)`))
    } else if (r.status === 'no') {
      updateStat((st) => ({ ...st, wrong: [...st.wrong, r.given] }))
      setSaved((s) => withEvent(s, `Schritt ${stepIndex + 1}: Eingabe „${r.given}“ passte nicht`))
    }
  }

  const onAgain = () => {
    const next = (version + 1) % lesson.steps[stepIndex].versions.length
    setVersion(next)
    if (result?.status !== 'ok') setResult(null)
    updateStat((st) => ({ ...st, again: st.again + 1 }))
    setSaved((s) => withEvent(s, `Schritt ${stepIndex + 1}: „Erklär es mir nochmal“ → ${VERSION_LABEL[lesson.steps[stepIndex].versions[next].key]}`))
  }

  const onNext = () => {
    if (stepIndex < lesson.steps.length - 1) {
      setStepIndex(stepIndex + 1)
      setVersion(0)
      setResult(null)
      return
    }
    const { farm, messages } = addEgg(saved.farm)
    setReward(messages)
    updateAttempt((a) => ({ ...a, finishedAt: new Date().toISOString() }))
    setSaved((s) => withEvent({ ...s, farm }, `Aufgabe fertig, 1 Ei bekommen${messages.length ? '. ' + messages.join(' ') : ''}`))
    setScreen('done')
  }

  const finishedLessons = [...new Set(saved.attempts.filter((a) => a.finishedAt).map((a) => a.lessonId))].map((id) => LESSONS[id]).filter(Boolean)

  switch (screen) {
    case 'home':
      return (
        <Home
          mood={mood}
          moodSavedAt={todayMood ? clock(todayMood.at) : null}
          onMood={(v) => {
            setMood(v)
            setMoodTouched(true)
          }}
          go={(s) => {
            if (s === 'camera' || s === 'practice') saveMoodIfNeeded()
            setScreen(s === 'family' ? 'pin' : s)
          }}
        />
      )
    case 'camera':
      return <Camera onPhoto={() => setScreen('confirm')} onBack={() => setScreen('home')} />
    case 'confirm':
      return <Confirm lesson={lesson} onYes={() => startLesson(lesson, 'Foto gemacht und bestätigt')} onNo={() => setScreen('camera')} />
    case 'step':
      return <StepScreen lesson={lesson} index={stepIndex} version={version} result={result} onAgain={onAgain} onResult={onResult} onNext={onNext} />
    case 'done':
      return <Done lesson={lesson} farm={saved.farm} rewardMessages={reward} onFarm={() => setScreen('farm')} onHome={() => setScreen('home')} />
    case 'practice':
      return (
        <PracticeMenu
          selection={saved.selection}
          openCount={finishedLessons.reduce((n, l) => n + l.practice.length, 0)}
          photoCount={saved.attempts.length}
          onSubject={(s) => {
            setSubject(s)
            setScreen('subject')
          }}
          go={setScreen}
        />
      )
    case 'subject':
      return (
        <SubjectScreen
          subject={subject}
          selection={saved.selection}
          onSubject={setSubject}
          onToggle={(t) =>
            setSaved((s) =>
              s.selection.includes(t) ? { ...s, selection: s.selection.filter((x) => x !== t) } : withEvent({ ...s, selection: [...s.selection, t] }, `Übungsbereich: „${t}“ ausgewählt`),
            )
          }
          onBack={() => setScreen('practice')}
        />
      )
    case 'selection':
      return (
        <SelectionScreen
          selection={saved.selection}
          onStart={(t) => startLesson(lesson, `Übung aus „Meine Auswahl“ gestartet (${t})`)}
          onChange={(next) => setSaved((s) => ({ ...s, selection: next }))}
          onBack={() => setScreen('practice')}
        />
      )
    case 'open':
      return <OpenScreen lessons={finishedLessons} onBack={() => setScreen('practice')} />
    case 'photos':
      return <PhotosScreen attempts={saved.attempts} onBack={() => setScreen('practice')} />
    case 'farm':
      return <FarmScreen farm={saved.farm} onBack={() => setScreen('home')} />
    case 'pin':
      return <PinGate pin={saved.parentPin} onSetPin={(p) => setSaved((s) => ({ ...s, parentPin: p }))} onOk={() => setScreen('family')} onBack={() => setScreen('home')} />
    case 'family':
      return <Family saved={saved} lessons={LESSONS} onBack={() => setScreen('home')} />
  }
}
