import { TypedUseSelectorHook, useDispatch } from "react-redux"
import { AppDispatch, RootState } from "../services/store"
import { useSelector } from "react-redux"

export const useAppDispatch = () =>{
  return useDispatch<AppDispatch>()
}

export const useAppSelector:TypedUseSelectorHook<RootState> = useSelector