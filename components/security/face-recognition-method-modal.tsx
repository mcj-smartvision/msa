'use client'

import { ModalOverlay } from '@/components/shared/modal-overlay'
import {
  FACE_RECOGNITION_METHOD_SECTIONS,
  FACE_RECOGNITION_METHOD_SUBTITLE,
  FACE_RECOGNITION_METHOD_TITLE,
} from '@/lib/attendance/face-recognition-method-copy'

export function FaceRecognitionMethodModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  return (
    <ModalOverlay
      open={open}
      onClose={onClose}
      title={FACE_RECOGNITION_METHOD_TITLE}
      className="sm:max-w-2xl"
    >
      <div className="space-y-5 text-start" dir="rtl" lang="fa">
        <p className="text-sm text-muted-foreground leading-relaxed">
          {FACE_RECOGNITION_METHOD_SUBTITLE}
        </p>

        {FACE_RECOGNITION_METHOD_SECTIONS.map((section) => (
          <section key={section.heading} className="space-y-2">
            <h3 className="text-sm font-semibold tracking-tight text-slate-900">
              {section.heading}
            </h3>

            {section.body ? (
              <p className="text-sm text-slate-700 leading-relaxed">{section.body}</p>
            ) : null}

            {section.steps ? (
              <ol className="space-y-2.5">
                {section.steps.map((step) => (
                  <li
                    key={step.title}
                    className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {step.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-800 leading-relaxed">{step.text}</p>
                  </li>
                ))}
              </ol>
            ) : null}

            {section.rows ? (
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <tbody>
                    {section.rows.map((row) => (
                      <tr key={row.label} className="border-b border-slate-100 last:border-0">
                        <th className="w-[34%] bg-slate-50 px-3 py-2.5 text-start align-top font-medium text-slate-700">
                          {row.label}
                        </th>
                        <td className="px-3 py-2.5 text-slate-800 leading-relaxed">{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {section.bullets ? (
              <ul className="list-disc space-y-1.5 ps-5 text-sm text-slate-700 leading-relaxed">
                {section.bullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}

            {section.quote ? (
              <blockquote className="rounded-lg border-s-4 border-emerald-600 bg-emerald-50/60 px-4 py-3 text-sm text-slate-800 leading-relaxed italic">
                {section.quote}
              </blockquote>
            ) : null}
          </section>
        ))}
      </div>
    </ModalOverlay>
  )
}
