'use client'

import {CreateRoadNavbar, CreateRoadZone} from '@/widgets/RoadMap/UI'
import {useEffect} from 'react'
import styles from './CreateRoadMapPage.module.scss'

function CreateRoadMapPage() {
  useEffect(() => {
    const header = document.querySelector('header') as HTMLElement | null
    if (header) header.style.borderBottom = '2px solid #EEEFF8'
    return () => {
      if (header) header.style.borderBottom = ''
    }
  }, [])

  return (
    <div className={styles.main}>
      <CreateRoadNavbar />
      <CreateRoadZone />
    </div>
  )
}

export default CreateRoadMapPage
