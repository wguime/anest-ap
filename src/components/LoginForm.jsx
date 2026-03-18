/**
 * LoginForm Component
 * Formulario de login com email e senha
 */
import { useState } from 'react';
import { Button, Input, FormField, Alert } from '@/design-system';
import { Mail, Lock, Loader2 } from 'lucide-react';

export function LoginForm({ onLogin, onForgotPassword, error, isLoading }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [validationErrors, setValidationErrors] = useState({});

  const validate = () => {
    const errors = {};

    if (!email.trim()) {
      errors.email = 'E-mail e obrigatorio';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'E-mail invalido';
    }

    if (!password) {
      errors.password = 'Senha e obrigatoria';
    } else if (password.length < 6) {
      errors.password = 'Senha deve ter pelo menos 6 caracteres';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) return;

    await onLogin(email, password);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          {error}
        </Alert>
      )}

      <FormField
        label="E-mail"
        required
        error={validationErrors.email}
      >
        <Input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (validationErrors.email) {
              setValidationErrors((prev) => ({ ...prev, email: null }));
            }
          }}
          placeholder="seu@email.com"
          leftIcon={<Mail className="w-4 h-4" />}
          autoComplete="email"
          disabled={isLoading}
        />
      </FormField>

      <FormField
        label="Senha"
        required
        error={validationErrors.password}
      >
        <Input
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (validationErrors.password) {
              setValidationErrors((prev) => ({ ...prev, password: null }));
            }
          }}
          placeholder="Sua senha"
          leftIcon={<Lock className="w-4 h-4" />}
          autoComplete="current-password"
          disabled={isLoading}
        />
      </FormField>

      <Button
        type="submit"
        className="w-full"
        disabled={isLoading}
        leftIcon={isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
      >
        {isLoading ? 'Entrando...' : 'Entrar'}
      </Button>

      <button
        type="button"
        onClick={onForgotPassword}
        className="w-full text-center text-sm text-primary hover:underline"
        disabled={isLoading}
      >
        Esqueceu a senha?
      </button>
    </form>
  );
}

export default LoginForm;
