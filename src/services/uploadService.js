/**
 * uploadService.js
 * Serviço de upload de mídia para Firebase Storage
 *
 * Estrutura Storage:
 * educacao/
 * ├── banners/{cursoId}/banner.{ext}
 * ├── thumbnails/{aulaId}/thumb.{ext}
 * └── videos/{aulaId}/video.{ext}
 */
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  listAll,
} from 'firebase/storage';
import { storage, auth } from '../config/firebase';

// ============================================
// AMBIENTE
// ============================================

const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';

/**
 * Verificar se deve usar mock (desenvolvimento sem auth)
 * @returns {boolean}
 */
const shouldUseMock = () => {
  return isDevelopment && !auth.currentUser;
};

// ============================================
// CONSTANTES DE VALIDAÇÃO
// ============================================

// Tipos de arquivo aceitos
export const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
export const ACCEPTED_AUDIO_TYPES = ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/m4a'];
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const ACCEPTED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/html',
];

// Tamanho máximo (em bytes)
export const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB
export const MAX_AUDIO_SIZE = 50 * 1024 * 1024; // 50MB
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_DOCUMENT_SIZE = 20 * 1024 * 1024; // 20MB

// Paths no Storage
const STORAGE_PATHS = {
  BANNERS: 'educacao/banners',
  THUMBNAILS: 'educacao/thumbnails',
  VIDEOS: 'educacao/videos',
  AUDIOS: 'educacao/audios',
  DOCUMENTS: 'educacao/documents',
};

// Document category storage paths (gestao documental)
export const DOC_STORAGE_PATHS = {
  etica: 'documentos/etica',
  comites: 'documentos/comites',
  auditorias: 'documentos/auditorias',
  relatorios: 'documentos/relatorios',
  biblioteca: 'documentos/biblioteca',
  financeiro: 'documentos/financeiro',
};

// ============================================
// VALIDAÇÃO
// ============================================

/**
 * Validar arquivo antes do upload
 * @param {File} file - Arquivo a ser validado
 * @param {string} type - Tipo esperado: 'video' | 'audio' | 'image' | 'document'
 * @returns {{ valid: boolean, errors: string[] }}
 */
export const validateFile = (file, type = 'video') => {
  const errors = [];

  if (!file) {
    errors.push('Nenhum arquivo selecionado');
    return { valid: false, errors };
  }

  // Validar tipo
  let acceptedTypes;
  let maxSize;

  switch (type) {
    case 'video':
      acceptedTypes = ACCEPTED_VIDEO_TYPES;
      maxSize = MAX_VIDEO_SIZE;
      break;
    case 'audio':
      acceptedTypes = ACCEPTED_AUDIO_TYPES;
      maxSize = MAX_AUDIO_SIZE;
      break;
    case 'image':
      acceptedTypes = ACCEPTED_IMAGE_TYPES;
      maxSize = MAX_IMAGE_SIZE;
      break;
    case 'document':
      acceptedTypes = ACCEPTED_DOCUMENT_TYPES;
      maxSize = MAX_DOCUMENT_SIZE;
      break;
    default:
      acceptedTypes = [];
      maxSize = 0;
  }

  if (!acceptedTypes.includes(file.type)) {
    errors.push(`Tipo de arquivo não suportado. Aceitos: ${acceptedTypes.join(', ')}`);
  }

  if (file.size > maxSize) {
    const maxMB = Math.round(maxSize / (1024 * 1024));
    errors.push(`Arquivo muito grande. Máximo: ${maxMB}MB`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Gerar nome de arquivo único
 * @param {string} originalName - Nome original do arquivo
 * @returns {string} Nome sanitizado com timestamp
 */
const generateFileName = (originalName) => {
  const timestamp = Date.now();
  const sanitized = originalName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9.-]/g, '');
  const ext = sanitized.split('.').pop();
  const name = sanitized.replace(`.${ext}`, '');
  return `${name}-${timestamp}.${ext}`;
};

/**
 * Extrair extensão do arquivo
 */
const getFileExtension = (filename) => {
  return filename.split('.').pop()?.toLowerCase() || '';
};

// ============================================
// UPLOAD PRINCIPAL
// ============================================

/**
 * Upload de arquivo para Firebase Storage
 * @param {File} file - Arquivo a ser enviado
 * @param {string} path - Caminho no Storage
 * @param {function} onProgress - Callback de progresso (0-100)
 * @returns {Promise<{ url: string, path: string, filename: string }>}
 */
export const uploadFile = async (file, path, onProgress) => {
  try {
    // Em desenvolvimento sem auth, usar mock
    if (shouldUseMock()) {
      const mockResult = await mockUpload(file, onProgress);
      return {
        url: mockResult.url,
        path: `mock/${path}/${mockResult.filename}`,
        filename: mockResult.filename,
        size: mockResult.size,
        type: mockResult.type,
        isMock: true,
      };
    }

    const filename = generateFileName(file.name);
    const storagePath = `${path}/${filename}`;
    const storageRef = ref(storage, storagePath);

    // Upload com monitoramento de progresso
    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: file.type,
    });

    return new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          // Progresso
          const progress = Math.round(
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          );
          onProgress?.(progress);
        },
        (error) => {
          // Erro
          console.error('Erro no upload:', error);
          reject(new Error(`Falha no upload: ${error.message}`));
        },
        async () => {
          // Sucesso
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            resolve({
              url: downloadURL,
              path: storagePath,
              filename,
              size: file.size,
              type: file.type,
            });
          } catch (error) {
            reject(new Error(`Erro ao obter URL: ${error.message}`));
          }
        }
      );
    });
  } catch (error) {
    console.error('Erro ao iniciar upload:', error);
    throw error;
  }
};

// ============================================
// UPLOADS ESPECÍFICOS
// ============================================

/**
 * Upload de banner de curso
 * @param {File} file - Arquivo de imagem
 * @param {string} cursoId - ID do curso
 * @param {function} onProgress - Callback de progresso
 * @returns {Promise<string>} URL do banner
 */
export const uploadBanner = async (file, cursoId, onProgress) => {
  // Validar
  const validation = validateFile(file, 'image');
  if (!validation.valid) {
    throw new Error(validation.errors.join('. '));
  }

  // Upload
  const result = await uploadFile(
    file,
    `${STORAGE_PATHS.BANNERS}/${cursoId}`,
    onProgress
  );

  return result.url;
};

/**
 * Upload de thumbnail de aula
 * @param {File} file - Arquivo de imagem
 * @param {string} aulaId - ID da aula
 * @param {function} onProgress - Callback de progresso
 * @returns {Promise<string>} URL da thumbnail
 */
export const uploadThumbnail = async (file, aulaId, onProgress) => {
  // Validar
  const validation = validateFile(file, 'image');
  if (!validation.valid) {
    throw new Error(validation.errors.join('. '));
  }

  // Upload
  const result = await uploadFile(
    file,
    `${STORAGE_PATHS.THUMBNAILS}/${aulaId}`,
    onProgress
  );

  return result.url;
};

/**
 * Upload de vídeo de aula
 * @param {File} file - Arquivo de vídeo
 * @param {string} aulaId - ID da aula
 * @param {function} onProgress - Callback de progresso
 * @returns {Promise<{ url: string, path: string }>}
 */
export const uploadVideo = async (file, aulaId, onProgress) => {
  // Validar
  const validation = validateFile(file, 'video');
  if (!validation.valid) {
    throw new Error(validation.errors.join('. '));
  }

  // Upload
  const result = await uploadFile(
    file,
    `${STORAGE_PATHS.VIDEOS}/${aulaId}`,
    onProgress
  );

  return {
    url: result.url,
    path: result.path,
    filename: result.filename,
    size: result.size,
  };
};

/**
 * Upload de áudio de aula
 * @param {File} file - Arquivo de áudio
 * @param {string} aulaId - ID da aula
 * @param {function} onProgress - Callback de progresso
 * @returns {Promise<{ url: string, path: string }>}
 */
export const uploadAudio = async (file, aulaId, onProgress) => {
  // Validar
  const validation = validateFile(file, 'audio');
  if (!validation.valid) {
    throw new Error(validation.errors.join('. '));
  }

  // Upload
  const result = await uploadFile(
    file,
    `${STORAGE_PATHS.AUDIOS}/${aulaId}`,
    onProgress
  );

  return {
    url: result.url,
    path: result.path,
    filename: result.filename,
    size: result.size,
  };
};

/**
 * Upload de documento (PDF para certificados, etc.)
 * @param {File} file - Arquivo PDF
 * @param {string} docId - ID do documento
 * @param {function} onProgress - Callback de progresso
 * @returns {Promise<{ url: string, path: string }>}
 */
export const uploadDocument = async (file, docId, onProgress) => {
  // Validar
  const validation = validateFile(file, 'document');
  if (!validation.valid) {
    throw new Error(validation.errors.join('. '));
  }

  // Upload
  const result = await uploadFile(
    file,
    `${STORAGE_PATHS.DOCUMENTS}/${docId}`,
    onProgress
  );

  return {
    url: result.url,
    path: result.path,
    filename: result.filename,
    size: result.size,
  };
};

/**
 * Upload de arquivo de gestao documental por categoria
 * @param {File} file - Arquivo (PDF, DOCX, XLSX, PPTX)
 * @param {string} category - Categoria do documento (etica, comites, etc.)
 * @param {string} docId - ID do documento
 * @param {function} onProgress - Callback de progresso
 * @returns {Promise<{ url: string, path: string, filename: string, size: number }>}
 */
export const uploadDocumentFile = async (file, category, docId, onProgress) => {
  // Validar arquivo
  const validation = validateFile(file, 'document');
  if (!validation.valid) {
    throw new Error(validation.errors.join('. '));
  }

  // Validar categoria
  const basePath = DOC_STORAGE_PATHS[category];
  if (!basePath) {
    throw new Error(`Categoria de documento inválida: ${category}`);
  }

  // Upload
  const result = await uploadFile(
    file,
    `${basePath}/${docId}`,
    onProgress
  );

  return {
    url: result.url,
    path: result.path,
    filename: result.filename,
    size: result.size,
    type: result.type,
  };
};

// ============================================
// DELEÇÃO
// ============================================

/**
 * Deletar arquivo do Storage
 * @param {string} storagePath - Caminho completo no Storage
 * @returns {Promise<void>}
 */
export const deleteFile = async (storagePath) => {
  try {
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
  } catch (error) {
    // Ignorar erro se arquivo não existir
    if (error.code !== 'storage/object-not-found') {
      console.error('Erro ao deletar arquivo:', error);
      throw error;
    }
  }
};

/**
 * Deletar todos os arquivos de um diretório
 * @param {string} directoryPath - Caminho do diretório
 * @returns {Promise<number>} Número de arquivos deletados
 */
export const deleteDirectory = async (directoryPath) => {
  try {
    const dirRef = ref(storage, directoryPath);
    const result = await listAll(dirRef);
    let count = 0;

    for (const item of result.items) {
      await deleteObject(item);
      count++;
    }

    // Recursivamente deletar subdiretórios
    for (const prefix of result.prefixes) {
      count += await deleteDirectory(prefix.fullPath);
    }

    return count;
  } catch (error) {
    console.error('Erro ao deletar diretório:', error);
    throw error;
  }
};

/**
 * Deletar banner de curso
 */
export const deleteBanner = async (cursoId) => {
  return deleteDirectory(`${STORAGE_PATHS.BANNERS}/${cursoId}`);
};

/**
 * Deletar arquivos de aula (vídeo, áudio, thumbnail)
 */
export const deleteAulaFiles = async (aulaId) => {
  let count = 0;
  count += await deleteDirectory(`${STORAGE_PATHS.VIDEOS}/${aulaId}`).catch(() => 0);
  count += await deleteDirectory(`${STORAGE_PATHS.AUDIOS}/${aulaId}`).catch(() => 0);
  count += await deleteDirectory(`${STORAGE_PATHS.THUMBNAILS}/${aulaId}`).catch(() => 0);
  return count;
};

// ============================================
// UTILIDADES
// ============================================

/**
 * Obter URL de download de um arquivo
 * @param {string} storagePath - Caminho no Storage
 * @returns {Promise<string>} URL de download
 */
export const getFileURL = async (storagePath) => {
  try {
    const storageRef = ref(storage, storagePath);
    return await getDownloadURL(storageRef);
  } catch (error) {
    console.error('Erro ao obter URL:', error);
    throw error;
  }
};

/**
 * Verificar se arquivo existe
 * @param {string} storagePath - Caminho no Storage
 * @returns {Promise<boolean>}
 */
export const fileExists = async (storagePath) => {
  try {
    const storageRef = ref(storage, storagePath);
    await getDownloadURL(storageRef);
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Revogar URL local (liberar memória de blob URLs)
 * @param {string} url - URL para revogar
 */
export const revokeUrl = (url) => {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
};

// ============================================
// MOCK PARA DESENVOLVIMENTO (fallback)
// ============================================

/**
 * Mock upload - simula upload e retorna URL local (para desenvolvimento offline)
 * @param {File} file - Arquivo
 * @param {function} onProgress - Callback de progresso
 * @returns {Promise<object>}
 */
export const mockUpload = async (file, onProgress) => {
  return new Promise((resolve, reject) => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      onProgress?.(progress);

      if (progress >= 100) {
        clearInterval(interval);

        // Criar URL local para preview
        const localUrl = URL.createObjectURL(file);
        const fileKey = `uploads/${Date.now()}-${file.name.replace(/\s+/g, '-')}`;

        resolve({
          success: true,
          url: localUrl,
          key: fileKey,
          filename: file.name,
          size: file.size,
          type: file.type,
          isMock: true,
        });
      }
    }, 100);

    // Simular erro aleatório (1% chance)
    if (Math.random() < 0.01) {
      clearInterval(interval);
      reject(new Error('Falha no upload simulado. Tente novamente.'));
    }
  });
};

// ============================================
// UPLOAD SERVICE (Interface Principal)
// ============================================

/**
 * Upload Service
 * Interface principal para upload de arquivos
 * Usa Firebase Storage em produção e mock em desenvolvimento (se necessário)
 */
export const uploadService = {
  /**
   * Upload completo (workflow simplificado)
   * @param {File} file - Arquivo
   * @param {string} type - Tipo: 'video' | 'audio' | 'image' | 'document'
   * @param {string} entityId - ID da entidade (curso, aula, etc.)
   * @param {function} onProgress - Callback de progresso
   * @param {boolean} useMock - Forçar uso de mock (desenvolvimento)
   */
  async upload(file, type = 'video', entityId, onProgress, useMock = false) {
    // Validar
    const validation = validateFile(file, type);
    if (!validation.valid) {
      throw new Error(validation.errors.join('. '));
    }

    // Usar mock se solicitado ou se storage não estiver disponível
    if (useMock) {
      return mockUpload(file, onProgress);
    }

    // Determinar path baseado no tipo
    let path;
    switch (type) {
      case 'video':
        path = `${STORAGE_PATHS.VIDEOS}/${entityId}`;
        break;
      case 'audio':
        path = `${STORAGE_PATHS.AUDIOS}/${entityId}`;
        break;
      case 'image':
        path = `${STORAGE_PATHS.THUMBNAILS}/${entityId}`;
        break;
      case 'document':
        path = `${STORAGE_PATHS.DOCUMENTS}/${entityId}`;
        break;
      default:
        throw new Error(`Tipo de upload não suportado: ${type}`);
    }

    // Fazer upload real
    return uploadFile(file, path, onProgress);
  },

  /**
   * Upload de banner de curso
   */
  uploadBanner,

  /**
   * Upload de thumbnail de aula
   */
  uploadThumbnail,

  /**
   * Upload de vídeo de aula
   */
  uploadVideo,

  /**
   * Upload de áudio de aula
   */
  uploadAudio,

  /**
   * Upload de documento (educacao)
   */
  uploadDocument,

  /**
   * Upload de documento de gestao documental por categoria
   */
  uploadDocumentFile,

  /**
   * Paths de storage por categoria documental
   */
  DOC_STORAGE_PATHS,

  /**
   * Deletar arquivo
   */
  deleteFile,

  /**
   * Deletar diretório
   */
  deleteDirectory,

  /**
   * Deletar banner de curso
   */
  deleteBanner,

  /**
   * Deletar arquivos de aula
   */
  deleteAulaFiles,

  /**
   * Obter URL de arquivo
   */
  getFileURL,

  /**
   * Verificar se arquivo existe
   */
  fileExists,

  /**
   * Revogar URL local (liberar memória)
   */
  revokeUrl,

  /**
   * Validar arquivo
   */
  validateFile,

  /**
   * Mock upload (desenvolvimento)
   */
  mockUpload,
};

export default uploadService;
