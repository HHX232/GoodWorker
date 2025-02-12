import style from './LoginPage.module.scss';
import React, { useRef } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { InputText } from 'primereact/inputtext';
import { Password } from 'primereact/password';
import { Link } from 'react-router-dom';
import FormSlider from '../../FormSlider/FormSlider';
import request from '../../../utils/request';
//@ts-ignore
import { Toast } from 'primereact/toast';
import { getCookie, setCookie } from '../../cookies/cookies';


// Интерфейс для данных формы
type FormInputs = {
  email: string;
  password: string;
};

const LoginPage = () => {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormInputs>({
    mode: 'onSubmit',
  });

  const toast = useRef<Toast>(null);
  const showSuccess = () => {
    toast.current?.show({
      severity: 'success',
      summary: 'Congratulations',
      detail: 'Login successful',
      life: 2500,
    });
  };
  const showError = () => {
    toast?.current?.show({severity:'error', summary: 'Error', detail:'Login Failed', life: 3000});
}

  // Функция обработки сабмита
  const onSubmit: SubmitHandler<FormInputs> = async (data) => {
    console.log('Form Submitted:', data);

    const dataReq = await request('auth/login', {
      method: 'POST',
      body: data,
    })
      .then((res: any) => {
        showSuccess()
        setCookie("refreshToken", res.refresh_token, { expires: new Date(Date.now() + 24 * 60 * 60 * 1000) });
        setCookie("accessToken", res.access_token, { expires: new Date(Date.now() + 24 * 60 * 60 * 1000) });
        
        return res;
      })
      .catch((err: any) => {
        console.log(err);
        showError()
      });
      console.log(getCookie('refreshToken'));
      console.log(getCookie('accessToken'));
    console.log(dataReq);
  };

  return (
    <div className={`${style.login_big_box}`}>
        <Toast ref={toast} />
      <div className={`${style.medium_box}`}>
        <form onSubmit={handleSubmit(onSubmit)} className={`${style.form_content}`}>
          <h2 className={`${style.signup_title}`}>Log In To GoodWorker</h2>
          <div className={`${style.inputs_mini_box}`}>
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
                feedback={false}
                onChange={(e) => {
                  setValue('password', e.target.value); // Установка значения в форму
                }}
              />
              {(errors.password || (watch('password') && watch('password').length < 8)) && (
                <div className={style.error_input}>Пароль 8+ символов</div>
              )}
            </div>
            {/* Кнопка Submit */}
            <button type="submit" className={`${style.signup_button}`}>
              Log In
            </button>
            <p className={`${style.have_text}`}>
            Create A New Account?{' '}
              <Link className={`${style.have_text_link}`} to="/signup">
                Sign Up
              </Link>
            </p>
          </div>
        </form>
        <FormSlider />
      </div>
    </div>
  );
};

export default LoginPage;
