/**
 * RegisterForm Component
 * Formulario de cadastro de novo usuario
 */
import { useState } from 'react';
import { Button, Input, FormField, Alert } from '@/design-system';
import { User, Mail, Lock, Loader2 } from 'lucide-react';

export function RegisterForm({ onRegister, error, isLoading }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationErrors, setValidationErrors] = useState({});

  const validate = () => {
    const errors = {};

    if (!name.trim()) {
      errors.name = 'Nome e obrigatorio';
    } else if (name.trim().length < 3) {
      errors.name = 'Nome deve ter pelo menos 3 caracteres';
    }

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

    if (!confirmPassword) {
      errors.confirmPassword = 'Confirme sua senha';
    } else if (password !== confirmPassword) {
      errors.confirmPassword = 'As senhas nao conferem';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) return;

    await onRegister(email, password, name);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          {error}
        </Alert>
      )}

      <FormField
        label="Nome completo"
        required
        error={validationErrors.name}
      >
        <Input
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (validationErrors.name) {
              setValidationErrors((prev) => ({ ...prev, name: null }));
            }
          }}
          placeholder="Seu nome completo"
          leftIcon={<User className="w-4 h-4" />}
          autoComplete="name"
          disabled={isLoading}
        />
      </FormField>

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
        hint="Minimo 6 caracteres"
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
          placeholder="Crie uma senha"
          leftIcon={<Lock className="w-4 h-4" />}
          autoComplete="new-password"
          disabled={isLoading}
        />
      </FormField>

      <FormField
        label="Confirmar senha"
        required
        error={validationErrors.confirmPassword}
      >
        <Input
          type="password"
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            if (validationErrors.confirmPassword) {
              setValidationErrors((prev) => ({ ...prev, confirmPassword: null }));
            }
          }}
          placeholder="Repita a senha"
          leftIcon={<Lock className="w-4 h-4" />}
          autoComplete="new-password"
          disabled={isLoading}
        />
      </FormField>

      <Button
        type="submit"
        className="w-full"
        disabled={isLoading}
        leftIcon={isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
      >
        {isLoading ? 'Criando conta...' : 'Criar conta'}
      </Button>
    </form>
  );
}

export default RegisterForm;
