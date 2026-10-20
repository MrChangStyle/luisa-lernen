import { useRef, useState } from 'react'
import { SAMPLE_LESSON } from './data/sampleLesson'
import { requestLesson, shrinkPhoto, type LessonAsk } from './logic/api'
import type { CheckResult } from './logic/check'
import { addEgg } from './logic/farm'
import { dayKey, moodText } from './logic/mood'
import { Family, PinGate } from './screens/Family'
import { FarmScreen } from './screens/Farm'
import { Home } from './screens/Home'
import { Camera, Confirm, Done, Problem, StepScreen, Waiting } from './screens/Learn'
import { SUBJECTS } from './data/subjects'
import { OpenScreen, PhotosScreen, PracticeMenu, SelectionScreen, SubjectScreen } from './screens/Practice'
import { archiveAttempts, clock, restoreAttempt, useSaved, withEvent, withLesson, type Attempt } from './state'
import { VERSION_LABEL, type Lesson } from './types'

const subjectOf = (topic: string) => Object.keys(SUBJECTS).find((k) => SUBJECTS[k].some((t) => t.name === topic)) ?? 'Mathe'

// Ein Auftrag an die KI: was sie erstellen soll und wohin es danach geht
interface Job {
  ask: LessonAsk | { mode: 'photo-file'; file: File }
  how: string
  waitText: string
  back: ScreenName
  confirm: boolean
  practiceKey?: string
}

type ScreenName =
  | 'home'
  | 'camera'
  | 'confirm'
  | 'step'
  | 'done'
  | 'waiting'
  | 'problem'
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
  const [lessonId, setLessonId] = useState<string>(SAMPLE_LESSON.id)
  const [job, setJob] = useState<Job | null>(null)
  const [problem, setProblem] = useState<{ text: string; retry: 'again' | 'photo'; detail?: string } | null>(null)
  const [practiceKey, setPracticeKey] = useState<string | null>(null)
  const abort = useRef<AbortController | null>(null)

  const lessons: Record<string, Lesson> = { [SAMPLE_LESSON.id]: SAMPLE_LESSON, ...saved.lessons }
  const lesson = lessons[lessonId] ?? SAMPLE_LESSON
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

  // Lässt die KI einen Lernpfad erstellen. Bei einem Foto kommt danach die Frage „Ist das die richtige Aufgabe?“.
  const run = async (j: Job) => {
    abort.current?.abort()
    const ctrl = new AbortController()
    abort.current = ctrl
    setJob(j)
    setScreen('waiting')
    try {
      const ask: LessonAsk = j.ask.mode === 'photo-file' ? { mode: 'photo', image: await shrinkPhoto(j.ask.file), mediaType: 'image/jpeg' } : j.ask
      const answer = await requestLesson(ask, ctrl.signal)
      if (ctrl.signal.aborted) return
      if ('lesson' in answer) {
        const l = answer.lesson
        setSaved((s) => withLesson(s, l))
        setLessonId(l.id)
        setPracticeKey(j.practiceKey ?? null)
        if (j.confirm) setScreen('confirm')
        else startLesson(l, j.how)
      } else if ('problem' in answer) {
        setProblem({ text: answer.problem, retry: 'photo' })
        setScreen('problem')
      } else {
        setProblem({ text: answer.error, retry: 'again', detail: answer.detail })
        setScreen('problem')
      }
    } catch {
      if (ctrl.signal.aborted) return
      setProblem({ text: 'Das Foto konnte nicht geöffnet werden. Mache bitte ein neues Foto.', retry: 'photo' })
      setScreen('problem')
    }
  }

  const cancel = () => {
    abort.current?.abort()
    setScreen(job?.back ?? 'home')
  }

  const startTopic = (subj: string, topic: string, back: ScreenName, how: string) =>
    run({ ask: { mode: 'topic', subject: subj, topic }, how, waitText: `Ich denke mir eine Aufgabe zu „${topic}“ aus.`, back, confirm: false })

  const startLesson = (l: Lesson, how: string, photo = false) => {
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
      photo,
    }
    setSaved((s) => withEvent({ ...s, attempts: [...s.attempts, attempt] }, `${how}: ${l.subject}, ${l.topic}`))
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

  const onStop = () => {
    setSaved((s) => withEvent(s, `Aufgabe bei Schritt ${stepIndex + 1} beendet`))
    setScreen('home')
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
    const done = practiceKey
    setSaved((s) =>
      withEvent(
        { ...s, farm, donePractice: done && !s.donePractice.includes(done) ? [...s.donePractice, done] : s.donePractice },
        `Aufgabe fertig, 1 Ei bekommen${messages.length ? '. ' + messages.join(' ') : ''}`,
      ),
    )
    setPracticeKey(null)
    setScreen('done')
  }

  // Offene Übungen: die zwei neuen Aufgaben jedes fertigen Lernpfads, die Luisa noch nicht gemacht hat
  const current = saved.attempts.filter((a) => !a.archivedAt)
  const finishedLessons = [...new Set(current.filter((a) => a.finishedAt).map((a) => a.lessonId))]
    .map((id) => lessons[id])
    .filter(Boolean)
    .map((l) => ({ ...l, practice: l.practice.filter((p) => !saved.donePractice.includes(`${l.id}#${p.text}`)) }))
    .filter((l) => l.practice.length > 0)
  // Ältere Einträge ohne Merkmal stammen aus der Testversion, in der jede Aufgabe ein Foto war
  const photoAttempts = current.filter((a) => a.photo ?? a.lessonId === SAMPLE_LESSON.id)
  const practiced = new Set(current.filter((a) => a.finishedAt).map((a) => a.topic))

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
      return (
        <Camera
          onPhoto={(file) => run({ ask: { mode: 'photo-file', file }, how: 'Foto gemacht und bestätigt', waitText: 'Ich lese deine Aufgabe.', back: 'camera', confirm: true })}
          onBack={() => setScreen('home')}
        />
      )
    case 'waiting':
      return <Waiting key={job?.waitText} text={job?.waitText ?? ''} onCancel={cancel} />
    case 'problem':
      return (
        <Problem
          text={problem?.text ?? ''}
          detail={problem?.detail}
          retry={problem?.retry === 'photo' ? 'Neues Foto machen' : 'Nochmal versuchen'}
          onRetry={() => (problem?.retry === 'photo' ? setScreen('camera') : job && run(job))}
          onBack={() => setScreen(job?.back === 'camera' ? 'home' : (job?.back ?? 'home'))}
        />
      )
    case 'confirm':
      return <Confirm lesson={lesson} onYes={() => startLesson(lesson, job?.how ?? 'Foto gemacht und bestätigt', true)} onNo={() => setScreen('camera')} />
    case 'step':
      return <StepScreen lesson={lesson} index={stepIndex} version={version} result={result} onAgain={onAgain} onResult={onResult} onNext={onNext} onStop={onStop} />
    case 'done':
      return <Done lesson={lesson} farm={saved.farm} rewardMessages={reward} onFarm={() => setScreen('farm')} onHome={() => setScreen('home')} />
    case 'practice':
      return (
        <PracticeMenu
          selection={saved.selection}
          openCount={finishedLessons.reduce((n, l) => n + l.practice.length, 0)}
          photoCount={photoAttempts.length}
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
          practiced={practiced}
          onStart={(t) => startTopic(subject, t, 'subject', `Übung gestartet (${subject})`)}
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
          onStart={(t) => startTopic(subjectOf(t), t, 'selection', 'Übung aus „Meine Auswahl“ gestartet')}
          onChange={(next) => setSaved((s) => ({ ...s, selection: next }))}
          onBack={() => setScreen('practice')}
        />
      )
    case 'open':
      return (
        <OpenScreen
          lessons={finishedLessons}
          onStart={(l, text) =>
            run({
              ask: { mode: 'task', subject: l.subject, topic: l.topic, text },
              how: 'Offene Übung gestartet',
              waitText: 'Ich bereite deine Übung vor.',
              back: 'open',
              confirm: false,
              practiceKey: `${l.id}#${text}`,
            })
          }
          onBack={() => setScreen('practice')}
        />
      )
    case 'photos':
      return <PhotosScreen attempts={photoAttempts} onBack={() => setScreen('practice')} />
    case 'farm':
      return <FarmScreen farm={saved.farm} onBack={() => setScreen('home')} />
    case 'pin':
      return <PinGate pin={saved.parentPin} onSetPin={(p) => setSaved((s) => ({ ...s, parentPin: p }))} onOk={() => setScreen('family')} onBack={() => setScreen('home')} />
    case 'family':
      return <Family saved={saved} lessons={lessons} onArchive={(ids) => setSaved((s) => archiveAttempts(s, ids))}
          onRestore={(id) => setSaved((s) => restoreAttempt(s, id))} onBack={() => setScreen('home')} />
  }
}
