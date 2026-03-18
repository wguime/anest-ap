/**
 * ForgotPasswordModal Component
 * Modal para recuperacao de senha
 */
import { useState } from 'react';
import { Modal, Button, Input, FormField, Alert } from '@/design-system';
import { Mail, Loader2, CheckCircle } from 'lucide-react';

export function ForgotPasswordModal({ open, onClose, onResetPassword }) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [validationError, setValidationError] = useState(null);

  const handleClose = () => {
    // Reset state when closing
    setEmail('');
    setSuccess(false);
    setError(null);
    setValidationError(null);
    setIsLoading(false);
    onClose();
  };

  const validate = () => {
    if (!email.trim()) {
      setValidationError('E-mail e obrigatorio');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setValidationError('E-mail invalido');
      return false;
    }
    setValidationError(null);
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) return;

    setIsLoading(true);
    setError(null);

    const result = await onResetPassword(email);

    setIsLoading(false);

    if (result.success) {
      setSuccess(true);
    } else {
      setError(result.error);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Recuperar senha"
      description={success ? null : "Digite seu e-mail para receber o link de recuperacao"}
      size="sm"
    >
      {success ? (
        <div className="text-center py-4">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-success" />
          </div>
          <h3 className="text-lg font-semibold text-black dark:text-white mb-2">
            E-mail enviado!
          </h3>
          <p className="text-sm text-muted-foreground mb-6">
            Verifique sua caixa de entrada e a pasta de spam.
            Siga as instruções para redefinir sua senha.
          </p>
          <Button onClick={handleClose} className="w-full">
            Fechar
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              {error}
            </Alert>
          )}

          <FormField
            label="E-mail cadastrado"
            required
            error={validationError}
          >
            <Input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (validationError) setValidationError(null);
              }}
              placeholder="seu@email.com"
              leftIcon={<Mail className="w-4 h-4" />}
              autoComplete="email"
              disabled={isLoading}
            />
          </FormField>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="flex-1"
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={isLoading}
              leftIcon={isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            >
              {isLoading ? 'Enviando...' : 'Enviar link'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

export default ForgotPasswordModal;
