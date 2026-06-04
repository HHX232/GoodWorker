'use client'

import {CreateRoadNavbar, CreateRoadZone} from '@/widgets/RoadMap/UI'
import {CreateRoadMapTutorial} from '@/widgets/Tutorial/CreateRoadMapTutorial'
import {useSearchParams} from 'next/navigation'
import {useEffect} from 'react'
import styles from './CreateRoadMapPage.module.scss'

function CreateRoadMapPage() {
  const searchParams = useSearchParams()
  const editId = searchParams.get('edit') ?? undefined

  useEffect(() => {
    const header = document.querySelector('header') as HTMLElement | null
    if (header) header.style.borderBottom = '2px solid #EEEFF8'
    return () => {
      if (header) header.style.borderBottom = ''
    }
  }, [])

  return (
    <div className={styles.main}>
      <CreateRoadMapTutorial />
      <CreateRoadNavbar />
      <CreateRoadZone editId={editId} />
    </div>
  )
}

export default CreateRoadMapPage
