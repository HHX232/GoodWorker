import { NextResponse } from 'next/server'

export function tooManyRequests() {
  return NextResponse.json(
    { error: 'Too many requests. Please try again later.' },
    { status: 429, headers: { 'Retry-After': '900' } }
  )
}