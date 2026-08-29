import { describe, expect, it } from 'vitest'
import { parseIsoDurationMinutes } from '@/lib/schedule-intelligence/durationUtils'
import { parseMicrosoftProjectXml } from '@/lib/schedule-intelligence/xmlParser'
import { FIXTURE_A_XML, FIXTURE_B_XML } from './fixtures'

describe('xmlParser', () => {
  it('reads tasks from MSP XML', () => {
    const { schedule } = parseMicrosoftProjectXml(FIXTURE_A_XML, 'test.xml')
    expect(schedule.tasks.length).toBe(3)
    expect(schedule.tasks.map((t) => t.name)).toEqual(['A', 'B', 'C'])
  })

  it('reads dependencies', () => {
    const { schedule } = parseMicrosoftProjectXml(FIXTURE_A_XML)
    expect(schedule.dependencies.length).toBe(2)
    expect(schedule.dependencies[0].type).toBe('FS')
  })

  it('converts ISO duration to minutes', () => {
    expect(parseIsoDurationMinutes('PT8H0M0S', 480)).toBe(480)
    expect(parseIsoDurationMinutes('P5D', 480)).toBe(2400)
  })

  it('warns on orphan predecessor', () => {
    const xml = `<?xml version="1.0"?><Project><MinutesPerDay>480</MinutesPerDay><Tasks><Task><UID>2</UID><Name>B</Name><Summary>0</Summary><Duration>PT8H0M0S</Duration><PredecessorLink><PredecessorUID>99</PredecessorUID><Type>1</Type></PredecessorLink></Task></Tasks></Project>`
    const { schedule } = parseMicrosoftProjectXml(xml)
    expect(schedule.warnings.some((w) => w.code === 'ORPHAN_PREDECESSOR')).toBe(true)
  })
})

describe('fixture B parallel', () => {
  it('parses parallel paths', () => {
    const { schedule } = parseMicrosoftProjectXml(FIXTURE_B_XML)
    expect(schedule.tasks.length).toBe(3)
    expect(schedule.dependencies.length).toBe(2)
  })
})
