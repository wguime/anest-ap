/**
 * LoginPage
 * Pagina de login imersiva com background animado full-screen
 * Logo centralizado nos 2/3 superiores, login no terço inferior
 */
import { useState, useEffect, useId } from 'react';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  AnimatedBackground,
  useToast,
} from '@/design-system';
import { ForgotPasswordModal } from '../components/ForgotPasswordModal';
import { PrivacyPolicyModal } from '../components/PrivacyPolicyModal';
import { useUser } from '../contexts/UserContext';
import { Fingerprint, ScanFace, Check } from 'lucide-react';
import { setPersistence, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';
import { auth } from '../config/firebase';
import { supabase } from '../config/supabase';
import {
  isBiometricAvailable,
  hasBiometricRegistered,
  registerBiometric,
  authenticateWithBiometric,
} from '../services/biometricService';

export default function LoginPage() {
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [biometricReady, setBiometricReady] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const { login, register, forgotPassword, error, isLoading, clearError } = useUser();
  const { toast } = useToast();

  // Verificar suporte a biometria ao montar
  useEffect(() => {
    (async () => {
      const supported = await isBiometricAvailable();
      setBiometricSupported(supported);
      if (supported && hasBiometricRegistered()) {
        setBiometricReady(true);
      }
    })();
  }, []);

  // Pinta html/body com greenDark (institucional) enquanto LoginPage está
  // montada — evita strip branco do body aparecendo abaixo do 100dvh em iOS
  // (home indicator area). Não mexe em classes/tema; restaura no unmount.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlBg = html.style.backgroundColor;
    const prevBodyBg = body.style.backgroundColor;
    html.style.backgroundColor = '#004225';
    body.style.backgroundColor = '#004225';
    return () => {
      html.style.backgroundColor = prevHtmlBg;
      body.style.backgroundColor = prevBodyBg;
    };
  }, []);

  const handleLogin = async (email, password) => {
    clearError();
    const result = await login(email, password);
    return result;
  };

  const handleRegister = async (email, password, name) => {
    clearError();
    const result = await register(email, password, name);
    return result;
  };

  const handleForgotPassword = async (email) => {
    const result = await forgotPassword(email);
    return result;
  };

  // Fluxo biometrico:
  // - Se ja registrado: autentica via biometria e faz login
  // - Se nao registrado: recebe email/password do form e registra + faz login
  const handleBiometricAuth = async (formEmail, formPassword) => {
    if (!biometricSupported) {
      toast({ title: 'Seu dispositivo não suporta Face ID / Touch ID', variant: 'destructive' });
      return;
    }

    clearError();

    if (biometricReady) {
      // Ja tem biometria registrada — autenticar
      const result = await authenticateWithBiometric();
      if (result.success) {
        await login(result.email, result.password);
      } else {
        toast({ title: result.error || 'Erro na autenticação biométrica', variant: 'destructive' });
      }
    } else if (formEmail && formPassword) {
      // Registrar biometria com credenciais do formulario
      const reg = await registerBiometric(formEmail, formPassword);
      if (!reg.success) {
        toast({ title: reg.error || 'Erro ao registrar biometria', variant: 'destructive' });
        return;
      }
      setBiometricReady(true);
      // Agora faz login
      await login(formEmail, formPassword);
    } else {
      toast({ title: 'Preencha e-mail e senha, depois toque em "Ativar Face ID / Touch ID" para configurar.' });
    }
  };

  return (
    // LoginPage é sempre dark (imersiva) — força .dark para tokens resolverem corretamente
    <div className="dark h-[100dvh] w-screen fixed inset-0 overflow-hidden bg-background">
      {/* Background Animado - FULL SCREEN */}
      <div className="absolute inset-0">
        <AnimatedBackground variant="combined" dotCount={25} />
      </div>

      {/* Container Principal - Fixo, sem scroll */}
      <div className="relative z-10 h-full w-full flex flex-col overflow-hidden">

        {/* Logo centralizado sobre os círculos (posição fixa em 38% = mesmo centro dos circles) */}
        <div className="absolute inset-x-0 flex justify-center pointer-events-none" style={{ top: '38%', transform: 'translateY(-50%)' }}>
          <picture>
            <source srcSet="/Anest2.webp" type="image/webp" />
            <img
              src="/Anest2.png"
              alt="ANEST"
              fetchpriority="high"
              decoding="async"
              className="w-[72vw] max-w-[440px] lg:w-[280px] object-contain drop-shadow-2xl"
            />
          </picture>
        </div>

        {/* Spacer para empurrar o form para baixo */}
        <div className="flex-1 min-h-0" />

        {/* Área Inferior - Formulário de login */}
        <div className="shrink-0 flex flex-col items-center px-4 pb-[5vh] lg:pb-[10vh]">
          <div className="w-full max-w-sm lg:max-w-[400px] flex flex-col">
            {/* Titulo */}
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white text-center mb-0.5 drop-shadow-lg shrink-0">
              Entrar
            </h1>
            <p className="text-muted-foreground text-center text-sm sm:text-base mb-2 sm:mb-3 shrink-0">
              Bem-Vindo à ANEST
            </p>

            {/* Tabs Login/Cadastro */}
            <Tabs defaultValue="login" variant="underline" className="w-full">
              <TabsList className="mb-1.5 sm:mb-2 border-b border-border">
                <TabsTrigger
                  value="login"
                  className="flex-1 text-muted-foreground text-sm sm:text-base data-[state=active]:text-primary data-[state=active]:border-primary"
                >
                  Login
                </TabsTrigger>
                <TabsTrigger
                  value="register"
                  className="flex-1 text-muted-foreground text-sm sm:text-base data-[state=active]:text-primary data-[state=active]:border-primary"
                >
                  Cadastro
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <LoginFormDark
                  onLogin={handleLogin}
                  onForgotPassword={() => setShowForgotPassword(true)}
                  onBiometric={handleBiometricAuth}
                  biometricReady={biometricReady}
                  biometricSupported={biometricSupported}
                  error={error}
                  isLoading={isLoading}
                />
              </TabsContent>

              <TabsContent value="register">
                <RegisterFormDark
                  onRegister={handleRegister}
                  error={error}
                  isLoading={isLoading}
                  onShowPrivacyPolicy={() => setShowPrivacyPolicy(true)}
                />
              </TabsContent>
            </Tabs>

          </div>
        </div>
      </div>

      {/* Modal Esqueceu Senha */}
      <ForgotPasswordModal
        open={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
        onResetPassword={handleForgotPassword}
      />

      {/* Modal Politica de Privacidade */}
      {showPrivacyPolicy && (
        <PrivacyPolicyModal onClose={() => setShowPrivacyPolicy(false)} />
      )}

    </div>
  );
}

/**
 * LoginFormDark - Formulario de login compacto para fundo escuro
 */
function LoginFormDark({ onLogin, onForgotPassword, onBiometric, biometricReady, biometricSupported, error, isLoading }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [keepLoggedIn, setKeepLoggedIn] = useState(true);
  const [validationErrors, setValidationErrors] = useState({});
  const emailId = useId();
  const passwordId = useId();

  const validate = () => {
    const errors = {};
    if (!email.trim()) {
      errors.email = 'E-mail é obrigatório';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'E-mail inválido';
    }
    if (!password) {
      errors.password = 'Senha é obrigatória';
    } else if (password.length < 6) {
      errors.password = 'Mínimo 6 caracteres';
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    await setPersistence(auth, keepLoggedIn ? browserLocalPersistence : browserSessionPersistence);
    await onLogin(email, password);
  };

  const inputClasses = (hasError) => `
    w-full px-3 py-2 sm:py-2.5
    bg-card/60 backdrop-blur-sm
    border ${hasError ? 'border-destructive/50' : 'border-border'}
    rounded-xl
    text-white text-sm sm:text-base placeholder:text-muted-foreground/70
    outline-none
    focus:border-primary focus:ring-1 focus:ring-primary/30
    transition-all duration-200
    disabled:opacity-50
  `;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1.5 sm:gap-2">
      {error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive px-3 py-1.5 rounded-xl text-[11px] sm:text-xs shrink-0">
          {error}
        </div>
      )}

      {/* Email */}
      <div className="shrink-0">
        <label htmlFor={emailId} className="block text-primary text-xs sm:text-sm font-medium mb-0.5">
          E-mail <span className="text-destructive">*</span>
        </label>
        <input
          id={emailId}
          type="email"
          autoComplete="email"
          required
          aria-invalid={!!validationErrors.email}
          aria-describedby={validationErrors.email ? `${emailId}-error` : undefined}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (validationErrors.email) setValidationErrors(prev => ({ ...prev, email: null }));
          }}
          placeholder="seu@email.com"
          disabled={isLoading}
          className={inputClasses(validationErrors.email)}
        />
        {validationErrors.email && (
          <p id={`${emailId}-error`} className="mt-0.5 text-[10px] text-destructive">{validationErrors.email}</p>
        )}
      </div>

      {/* Senha */}
      <div className="shrink-0">
        <label htmlFor={passwordId} className="block text-primary text-xs sm:text-sm font-medium mb-0.5">
          Senha <span className="text-destructive">*</span>
        </label>
        <input
          id={passwordId}
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={!!validationErrors.password}
          aria-describedby={validationErrors.password ? `${passwordId}-error` : undefined}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (validationErrors.password) setValidationErrors(prev => ({ ...prev, password: null }));
          }}
          placeholder="Sua senha"
          disabled={isLoading}
          className={inputClasses(validationErrors.password)}
        />
        {validationErrors.password && (
          <p id={`${passwordId}-error`} className="mt-0.5 text-[10px] text-destructive">{validationErrors.password}</p>
        )}
      </div>

      {/* Manter conectado */}
      <label className="flex items-center gap-2 cursor-pointer select-none shrink-0 py-0.5">
        <button
          type="button"
          role="checkbox"
          aria-checked={keepLoggedIn}
          onClick={() => setKeepLoggedIn(!keepLoggedIn)}
          className={`
            w-4 h-4 sm:w-[18px] sm:h-[18px] rounded
            border flex items-center justify-center
            transition-all duration-200 shrink-0
            ${keepLoggedIn
              ? 'bg-primary border-primary'
              : 'bg-transparent border-muted-foreground/70'}
          `}
        >
          {keepLoggedIn && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
        </button>
        <span className="text-muted-foreground text-sm sm:text-base">Manter conectado</span>
      </label>

      {/* Botao Entrar */}
      <button
        type="submit"
        disabled={isLoading}
        className="
          w-full py-2 sm:py-2.5
          bg-gradient-to-r from-greenDark to-greenMedium
          hover:from-greenDarkest hover:to-greenDark
          text-white font-semibold text-base sm:text-lg
          rounded-xl
          shadow-lg shadow-greenDark/30
          hover:shadow-xl hover:shadow-greenDark/40
          active:scale-[0.98]
          transition-all duration-200
          disabled:opacity-50 disabled:cursor-not-allowed
          shrink-0
        "
      >
        {isLoading ? 'Entrando...' : 'Entrar'}
      </button>

      {/* Link Biometria — so mostra se o dispositivo suporta */}
      {biometricSupported && (
        <button
          type="button"
          onClick={() => onBiometric(email, password)}
          disabled={isLoading}
          className={`
            w-full flex items-center justify-center gap-3
            py-1.5
            text-base sm:text-lg font-medium
            transition-colors duration-200
            disabled:opacity-50
            shrink-0
            ${biometricReady
              ? 'text-primary hover:text-primary-hover'
              : 'text-muted-foreground/70 hover:text-muted-foreground'}
          `}
        >
          <ScanFace className="w-5 h-5 sm:w-6 sm:h-6" />
          <span>{biometricReady ? 'Entrar com Face ID / Touch ID' : 'Ativar Face ID / Touch ID'}</span>
          <Fingerprint className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      )}

      {/* Esqueceu a senha */}
      <button
        type="button"
        onClick={onForgotPassword}
        disabled={isLoading}
        className="
          w-full text-center
          text-muted-foreground hover:text-primary
          text-sm sm:text-base
          transition-colors duration-200
          disabled:opacity-50
          shrink-0
        "
      >
        Esqueceu a senha?
      </button>
    </form>
  );
}

/**
 * RegisterFormDark - Formulario de cadastro compacto para fundo escuro
 */
function getPasswordStrength(pw) {
  if (!pw) return { level: 0, label: '', color: '' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  // Hex espelham DS: --destructive, --warning, --success, --primary (dark)
  if (score <= 1) return { level: 1, label: 'Fraca', color: '#DC2626' };
  if (score <= 2) return { level: 2, label: 'Razoável', color: '#F59E0B' };
  if (score <= 3) return { level: 3, label: 'Boa', color: '#34C759' };
  return { level: 4, label: 'Forte', color: '#2ECC71' };
}

function RegisterFormDark({ onRegister, error, isLoading, onShowPrivacyPolicy }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [lgpdConsent, setLgpdConsent] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const nameId = useId();
  const emailId = useId();
  const passwordId = useId();
  const confirmId = useId();
  // null | 'checking' | 'authorized' | 'not-authorized'
  const [authStatus, setAuthStatus] = useState(null);

  const strength = getPasswordStrength(password);

  // Pre-check (debounced) para mostrar inline antes do submit se email nao autorizado.
  // Reset de status quando email muda (esLint set-state-in-effect e aceitavel aqui:
  // o effect modela a sincronizacao com sistema externo — Supabase RPC).
  const trimmedEmail = email.trim().toLowerCase();
  const isValidEmail = !!trimmedEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);

  useEffect(() => {
    if (!isValidEmail) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAuthStatus(null);
      return undefined;
    }
    let cancelled = false;
    setAuthStatus('checking');
    const timeout = setTimeout(async () => {
      try {
        // RPC SECURITY DEFINER, GRANT TO anon — funciona sem JWT
        const { data, error: queryError } = await supabase.rpc('rpc_is_email_authorized', {
          p_email: trimmedEmail,
        });
        if (cancelled) return;
        if (queryError) {
          setAuthStatus(null);
          return;
        }
        setAuthStatus(data === true ? 'authorized' : 'not-authorized');
      } catch {
        if (!cancelled) setAuthStatus(null);
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [trimmedEmail, isValidEmail]);

  const validate = () => {
    const errors = {};
    if (!name.trim()) {
      errors.name = 'Nome é obrigatório';
    } else if (name.trim().length < 3) {
      errors.name = 'Mínimo 3 caracteres';
    }
    if (!email.trim()) {
      errors.email = 'E-mail é obrigatório';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'E-mail inválido';
    }
    if (!password) {
      errors.password = 'Senha é obrigatória';
    } else if (password.length < 8) {
      errors.password = 'Mínimo 8 caracteres';
    }
    if (!confirmPassword) {
      errors.confirmPassword = 'Confirme a senha';
    } else if (password !== confirmPassword) {
      errors.confirmPassword = 'Senhas não conferem';
    }
    if (!lgpdConsent) {
      errors.lgpdConsent = 'Aceite a Política de Privacidade para continuar';
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    if (authStatus === 'not-authorized') {
      setValidationErrors(prev => ({
        ...prev,
        email: 'Email nao autorizado. Solicite ao administrador para liberar seu acesso.',
      }));
      return;
    }
    await onRegister(email, password, name);
  };

  const inputClasses = (hasError) => `
    w-full px-3 py-1.5 sm:py-2
    bg-card/60 backdrop-blur-sm
    border ${hasError ? 'border-destructive/50' : 'border-border'}
    rounded-xl
    text-white text-sm sm:text-base placeholder:text-muted-foreground/70
    outline-none
    focus:border-primary focus:ring-1 focus:ring-primary/30
    transition-all duration-200
    disabled:opacity-50
  `;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1 sm:gap-1.5">
      {error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive px-3 py-1 rounded-xl text-[10px] sm:text-xs shrink-0">
          {error}
        </div>
      )}

      {/* Nome */}
      <div className="shrink-0">
        <label htmlFor={nameId} className="block text-primary text-[10px] sm:text-xs font-medium mb-0.5">
          Nome completo <span className="text-destructive">*</span>
        </label>
        <input
          id={nameId}
          type="text"
          autoComplete="name"
          required
          aria-invalid={!!validationErrors.name}
          aria-describedby={validationErrors.name ? `${nameId}-error` : undefined}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (validationErrors.name) setValidationErrors(prev => ({ ...prev, name: null }));
          }}
          placeholder="Seu nome"
          disabled={isLoading}
          className={inputClasses(validationErrors.name)}
        />
        {validationErrors.name && (
          <p id={`${nameId}-error`} className="mt-0.5 text-[9px] sm:text-[10px] text-destructive">{validationErrors.name}</p>
        )}
      </div>

      {/* Email */}
      <div className="shrink-0">
        <label htmlFor={emailId} className="block text-primary text-[10px] sm:text-xs font-medium mb-0.5">
          E-mail <span className="text-destructive">*</span>
        </label>
        <input
          id={emailId}
          type="email"
          autoComplete="email"
          required
          aria-invalid={!!validationErrors.email || authStatus === 'not-authorized'}
          aria-describedby={validationErrors.email ? `${emailId}-error` : undefined}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (validationErrors.email) setValidationErrors(prev => ({ ...prev, email: null }));
          }}
          placeholder="seu@email.com"
          disabled={isLoading}
          className={inputClasses(validationErrors.email || authStatus === 'not-authorized')}
        />
        {validationErrors.email && (
          <p id={`${emailId}-error`} className="mt-0.5 text-[9px] sm:text-[10px] text-destructive">{validationErrors.email}</p>
        )}
        {!validationErrors.email && authStatus === 'not-authorized' && (
          <p className="mt-0.5 text-[9px] sm:text-[10px] text-destructive">
            Email nao autorizado. Solicite ao administrador para liberar seu acesso.
          </p>
        )}
        {!validationErrors.email && authStatus === 'authorized' && (
          <p className="mt-0.5 text-[9px] sm:text-[10px] text-success">
            Email autorizado.
          </p>
        )}
      </div>

      {/* Senha */}
      <div className="shrink-0">
        <label htmlFor={passwordId} className="block text-primary text-[10px] sm:text-xs font-medium mb-0.5">
          Senha <span className="text-destructive">*</span>
        </label>
        <input
          id={passwordId}
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={!!validationErrors.password}
          aria-describedby={validationErrors.password ? `${passwordId}-error` : undefined}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (validationErrors.password) setValidationErrors(prev => ({ ...prev, password: null }));
          }}
          placeholder="Mínimo 8 caracteres"
          disabled={isLoading}
          className={inputClasses(validationErrors.password)}
        />
        {password && (
          <div className="mt-1 flex items-center gap-1.5">
            <div className="flex-1 h-1 rounded-full bg-border overflow-hidden flex gap-0.5">
              {[1, 2, 3, 4].map(i => (
                <div
                  key={i}
                  className="flex-1 rounded-full transition-colors duration-200"
                  style={{ backgroundColor: i <= strength.level ? strength.color : 'transparent' }}
                />
              ))}
            </div>
            <span className="text-[9px] sm:text-[10px] font-medium" style={{ color: strength.color }}>
              {strength.label}
            </span>
          </div>
        )}
        {validationErrors.password && (
          <p id={`${passwordId}-error`} className="mt-0.5 text-[9px] sm:text-[10px] text-destructive">{validationErrors.password}</p>
        )}
      </div>

      {/* Confirmar Senha */}
      <div className="shrink-0">
        <label htmlFor={confirmId} className="block text-primary text-[10px] sm:text-xs font-medium mb-0.5">
          Confirmar senha <span className="text-destructive">*</span>
        </label>
        <input
          id={confirmId}
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={!!validationErrors.confirmPassword}
          aria-describedby={validationErrors.confirmPassword ? `${confirmId}-error` : undefined}
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            if (validationErrors.confirmPassword) setValidationErrors(prev => ({ ...prev, confirmPassword: null }));
          }}
          placeholder="Repita a senha"
          disabled={isLoading}
          className={inputClasses(validationErrors.confirmPassword)}
        />
        {validationErrors.confirmPassword && (
          <p id={`${confirmId}-error`} className="mt-0.5 text-[9px] sm:text-[10px] text-destructive">{validationErrors.confirmPassword}</p>
        )}
      </div>

      {/* Checkbox LGPD */}
      <div className="shrink-0">
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={lgpdConsent}
            onChange={(e) => {
              setLgpdConsent(e.target.checked);
              if (validationErrors.lgpdConsent) setValidationErrors(prev => ({ ...prev, lgpdConsent: null }));
            }}
            disabled={isLoading}
            className="mt-0.5 w-4 h-4 rounded border-border bg-card/60 text-primary focus:ring-primary/30 shrink-0"
          />
          <span className="text-[10px] sm:text-[11px] text-muted-foreground leading-tight">
            Li e aceito a{' '}
            <button
              type="button"
              onClick={onShowPrivacyPolicy}
              className="text-primary underline hover:text-primary-hover"
            >
              Política de Privacidade
            </button>
            {' '}(LGPD)
          </span>
        </label>
        {validationErrors.lgpdConsent && (
          <p className="mt-0.5 text-[9px] sm:text-[10px] text-destructive">{validationErrors.lgpdConsent}</p>
        )}
      </div>

      {/* Botao Cadastrar */}
      <button
        type="submit"
        disabled={isLoading}
        className="
          w-full py-2 sm:py-2.5
          bg-gradient-to-r from-greenDark to-greenMedium
          hover:from-greenDarkest hover:to-greenDark
          text-white font-semibold text-base sm:text-lg
          rounded-xl
          shadow-lg shadow-greenDark/30
          hover:shadow-xl hover:shadow-greenDark/40
          active:scale-[0.98]
          transition-all duration-200
          disabled:opacity-50 disabled:cursor-not-allowed
          shrink-0
        "
      >
        {isLoading ? 'Criando conta...' : 'Criar conta'}
      </button>
    </form>
  );
}
