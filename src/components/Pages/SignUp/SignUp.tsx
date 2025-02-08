import React, { useEffect, useRef, useState, FC } from 'react';
//@ts-ignore
import { useForm, SubmitHandler } from 'react-hook-form';
//@ts-ignore
import { Toast } from 'primereact/toast';
//@ts-ignore
import { InputText } from 'primereact/inputtext';
//@ts-ignore
import { Password } from 'primereact/password';
//@ts-ignore
import { Link } from 'react-router-dom';
//@ts-ignore
import style from './SignUp.module.scss';
import request from '../../../utils/request';
import Slider from 'react-slick';
import stubImg from '../../../images/stubs_4k/stub_2.jpg'
import stubImg2 from '../../../images/stubs_4k/Rectangle 3.jpg'
import stubImg3 from '../../../images/stubs_4k//stub_3.jpg'
import {v4 as uuid} from 'uuid';
import arrowRight from '../../../images/svg/arrow_right.svg'
import arrowLeft from '../../../images/svg/arrow_left.svg'
import { InputOtp } from 'primereact/inputotp';
import { InputHTMLAttributes } from 'react';
import PinCode from '../PinCode/PinCode';
import FormSlider from '../../FormSlider/FormSlider';
import { setCookie } from '../../cookies/cookies';




type FormInputs = {
  username: string;
  email: string;
  password: string;
};

const SignUp = () => {
  const { register, handleSubmit, setValue,watch, trigger, formState: { errors } } = useForm<FormInputs>({
    mode: 'onSubmit',
  });
  
  const toast = useRef<Toast>(null);
  const watchedPassword = watch('password')
  const [dataIsSend, setDataIsSend] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  
  const showSuccess = () => {
    toast.current?.show({
      severity: 'success',
      summary: 'Congratulations',
      detail: 'Account successfully created',
      life: 2500,
    });
  };

  const onSubmit: SubmitHandler<FormInputs> = async (data: any) => {
    if (watchedPassword.length < 8) {
        console.log("Error pass!");
        return; 
    }
    
    console.log('Submitted Data:', data);
    const showInfo = (text: string) => {
      toast.current?.show({severity:'info', summary: 'Info', detail:text, life: 3000});
  }
    try {
        const res:any = await request('auth/signup', {
            method: 'POST',
            body: data, 
        });
  
        console.log("Response in SignUp:", res);
        // !Исправить под проверку
        // setCookie("refreshToken", res.refresh_token, { expires: new Date(Date.now() + 24 * 60 * 60 * 1000) });
        // setCookie("accessToken", res.access_token, { expires: new Date(Date.now() + 24 * 60 * 60 * 1000) });

        setDataIsSend(true);
        setUserEmail(data?.email);
        setUserName(data?.username);
        showInfo(res?.message)
        // showSuccess();
    } catch (error: any) {
        console.error("Error during request:", error);
    }
};


  
  return (
    <div className={`${style.signUp_big_box}`}>
      <div className={`${style.medium_box}`}>
        <Toast ref={toast} />

        {!dataIsSend ? <form onSubmit={handleSubmit(onSubmit)} className={`${style.form_content}`}>
  <h2 className={`${style.signup_title}`}>Sign Up To GoodWorker</h2>
  <div className={`${style.inputs_mini_box}`}>
    {/* Поле Name */}
    <div>
      <InputText
        placeholder="Username"
        className={`${style.input_name} ${watch('username') ? style.border_input : ''}`}
        {...register('username', { required: 'Name is required' })}
      />
      {errors.username && <div className={style.error_input}>{errors.username.message}</div>}
    </div>
    {/* Поле Email */}
    <div>
      <InputText
        placeholder="Email"
        className={`${style.input_email} ${watch('email') ? style.border_input : ''}`}
        {...register('email', {
          required: 'Email is required',
          pattern: {
            value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            message: 'Invalid email address',
          },
        })}
      />
      {errors.email && <div className={style.error_input}>{errors.email.message}</div>}
    </div>
    {/* Поле Password */}
    <div>
      <Password
        placeholder="Password"
        className={`${style.input_password} ${watch('password') ? style.border_input : ''}`}
        toggleMask
        feedback={false} // Отключение подсказок
        onChange={(e) => {
          setValue('password', e.target.value); // Установка значения
        }}
      />
      {(errors.password || (watchedPassword && watchedPassword.length < 8)) && <div className={style.error_input}>{"Пароль 8+ символов"}</div>}
    </div>
    {/* Кнопка Submit */}
    <button type="submit" className={`${style.signup_button}`}>
      Sign Up
    </button>
    <p className={`${style.have_text}`}>
      Already Have An Account?{' '}
      <Link className={`${style.have_text_link}`} to="/login">
        Log In
      </Link>
    </p>
  </div>
</form> :
<PinCode userEmail={userEmail} userName={userName} />
}



       <FormSlider/>
      </div>
    </div>
  );
};

export default SignUp;
