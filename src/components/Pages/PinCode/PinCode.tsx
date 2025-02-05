
import React, { FC, useRef, useState } from 'react';
import { InputOtp } from 'primereact/inputotp';
import { InputHTMLAttributes } from 'react';
import style from './PinCode.module.scss';
//@ts-ignore
import { Toast } from 'primereact/toast';


interface CustomInputProps extends InputHTMLAttributes<HTMLInputElement> {
    events: React.HTMLAttributes<HTMLInputElement>;
    props: React.HTMLAttributes<HTMLInputElement>;
}

export  function TemplateDemo({setData, token}:any) {
    const customInput:any = ({ events, props }: CustomInputProps) => (
    <input {...events} {...props} type="text" className="custom-otp-input" />
    );
  
    return (
        <div className="card flex justify-content-center">
            <style scoped>
                {`
                    .custom-otp-input {
                        width: 100px;
                        font-size: 70px;
                        border: 0 none;
                        appearance: none;
                        text-align: center;
                        transition: all 0.2s;
                        background: transparent;
                        border-bottom: 2px solid #141416;
                        text-transform: uppercase;
                    }
                     .p-inputotp{
                     gap: 25px;
 
                     }
                    .custom-otp-input:focus {
                        outline: 0 none;
                        border-bottom-color: var(--primary-color);
                    }
                `}
            </style>

            <InputOtp value={token} onChange={(e: any) => setData(e?.value)} inputTemplate={customInput}/>
        </div>
    );
}
    interface IPinCode {userEmail:string,userName:string}
    
const PinCode:FC<IPinCode> = ({userEmail,userName}) => {
   const [token, setTokens] = useState<string | number | undefined>();
   const toast = useRef<Toast>(null);

   const showSuccess = () => {
      toast.current?.show({
        severity: 'success',
        summary: 'Поздравляем',
        detail: 'Аккаунт успешно создан',
        life: 25000,
      });
    };
    const showError = () => {
      toast?.current?.show({severity:'error', summary: 'Error', detail:'PIN Error', life: 3000});
  }
   const onSubmit = () =>{

      if(!token){
         return
      }
      token === "1111" ? showSuccess() : showError()
      
   }
   return <div className={`${style.pin_code_box}`}>
      
        <Toast ref={toast} />
      <h2 className={`${style.pin_code_title}`}>Set A PIN Code</h2>
      <p className={`${style.pin_code_subtitle}`}>Enter 04 Digit Code</p>
   <TemplateDemo token={token} setData={setTokens} />
   <button onClick={onSubmit} className={`${style.pin_code_button}`} type='submit'>verify</button>
   </div>
}

export default PinCode