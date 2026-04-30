import { createSwaggerSpec } from 'next-swagger-doc';

export const getApiDocs = async () => {
  const spec = createSwaggerSpec({
    apiFolder: 'src/app/api',
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'Phidias API Documentation',
        version: '1.0.0',
        description: 'Phidias 3D AI Platform API - 包含 Qwen AI、ReconViaGen、Segmentation、Smart Organize 等服務',
        contact: {
          name: 'Phidias Team',
        },
      },
      servers: [
        {
          url: '/api/phidias',
          description: 'Phidias API Proxy',
        },
      ],
      tags: [
        { name: 'Qwen AI', description: '文字生成圖片、圖片編輯、多角度生成、下載產出檔案' },
        { name: 'ReconViaGen', description: '單張/多張圖片生成 3D 模型 (GLB, Gaussian, Radiance, Mesh, PLY)' },
        { name: 'Segmentation', description: '3D 模型 SAM 分割與 P3-SAM 下載' },
        { name: 'Smart Organize', description: '智慧整理 3D 模型零件（VLM 自動命名與分組）' },
      ],
      components: {
        schemas: {
          // Job related schemas
          JobSubmitResponse: {
            type: 'object',
            properties: {
              job_id: { type: 'string', description: 'Job unique identifier' },
              status: { type: 'string', enum: ['queued', 'processing', 'completed', 'failed'], description: 'Job status' },
              queue_position: { type: 'integer', description: 'Current position in queue' },
            },
            required: ['job_id', 'status', 'queue_position'],
          },
          JobStatusResponse: {
            type: 'object',
            properties: {
              job_id: { type: 'string' },
              status: { type: 'string', enum: ['queued', 'processing', 'completed', 'failed'] },
              queue_position: { type: 'integer', nullable: true },
              created_at: { type: 'string', format: 'date-time' },
              result: { type: 'object', description: 'Job result data (varies by endpoint)' },
              error: {
                type: 'object',
                properties: {
                  error_code: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
            required: ['job_id', 'status', 'queue_position', 'created_at'],
          },
          // Qwen schemas
          QwenText2ImgRequest: {
            type: 'object',
            properties: {
              prompt: { type: 'string', description: 'Text prompt for image generation' },
              negative_prompt: { type: 'string', description: 'Negative prompt' },
              aspect_ratio: { type: 'string', enum: ['16:9', '4:3', '1:1', '3:4', '9:16'], description: 'Output image aspect ratio' },
              num_steps: { type: 'integer', minimum: 1, maximum: 50, default: 25, description: 'Number of inference steps' },
              cfg_scale: { type: 'number', minimum: 1, maximum: 20, default: 7.5, description: 'Classifier-free guidance scale' },
              seed: { type: 'integer', nullable: true, description: 'Random seed' },
              num_samples: { type: 'integer', minimum: 1, maximum: 4, default: 1, description: 'Number of images to generate' },
            },
            required: ['prompt'],
          },
          QwenText2ImgResponse: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              request_id: { type: 'string' },
              urls: { type: 'array', items: { type: 'string', format: 'uri' } },
              seeds: { type: 'array', items: { type: 'integer' } },
            },
            required: ['status', 'request_id', 'urls', 'seeds'],
          },
          QwenEditRequest: {
            type: 'object',
            properties: {
              image: { type: 'string', format: 'binary', description: 'Input image file' },
              prompt: { type: 'string', description: 'Edit prompt' },
              negative_prompt: { type: 'string' },
              steps: { type: 'integer', default: 40, description: 'Inference steps (1–100)' },
              cfg_scale: { type: 'number', default: 4.0, description: 'Guidance scale (0–20)' },
              seed: { type: 'integer', default: 42, description: 'RNG seed (accepted but each sample uses independent seed)' },
              num_samples: { type: 'integer', default: 1, description: 'Number of results (1–6)' },
            },
            required: ['image', 'prompt'],
          },
          QwenEditMultiRequest: {
            type: 'object',
            properties: {
              images: { type: 'array', items: { type: 'string', format: 'binary' }, description: 'Multiple input image files' },
              prompt: { type: 'string', description: 'Edit instruction' },
              steps: { type: 'integer', default: 40, description: 'Inference steps (1–100)' },
              cfg_scale: { type: 'number', default: 4.0, description: 'Guidance scale (0–20)' },
              seed: { type: 'integer', default: 42, description: 'RNG seed' },
            },
            required: ['images', 'prompt'],
          },
          QwenMultiAngleRequest: {
            type: 'object',
            properties: {
              image: { type: 'string', format: 'binary', description: 'Input image file' },
              prompt: { type: 'string', description: 'Description for multi-angle generation' },
              steps: { type: 'integer', default: 40, description: 'Inference steps (1–100)' },
              cfg_scale: { type: 'number', default: 7.5, description: 'Guidance scale (0–20)' },
              seed: { type: 'integer', description: 'RNG seed' },
              num_samples: { type: 'integer', default: 1, description: 'Number of results (1–6)' },
            },
            required: ['image', 'prompt'],
          },
          QwenMultiAngleResponse: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              request_id: { type: 'string' },
              input_url: { type: 'string', format: 'uri' },
              results: {
                type: 'object',
                properties: {
                  right: { type: 'string', format: 'uri' },
                  back: { type: 'string', format: 'uri' },
                  left: { type: 'string', format: 'uri' },
                },
              },
            },
          },
          // ReconViaGen schemas
          ReconViaGenSingleRequest: {
            type: 'object',
            properties: {
              image: { type: 'string', format: 'binary', description: 'Single input image file' },
              prompt: { type: 'string', description: 'Generation prompt' },
            },
            required: ['image'],
          },
          ReconViaGenMultiRequest: {
            type: 'object',
            properties: {
              images: { type: 'array', items: { type: 'string', format: 'binary' }, description: 'Multiple input images' },
              prompt: { type: 'string' },
            },
            required: ['images'],
          },
          ReconViaGenBatchRequest: {
            type: 'object',
            properties: {
              zip_file: { type: 'string', format: 'binary', description: 'ZIP file containing multiple images' },
              prompt: { type: 'string' },
            },
            required: ['zip_file'],
          },
          ReconViaGenOutput: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              request_id: { type: 'string' },
              glb_url: { type: 'string', format: 'uri', description: '3D model GLB file URL' },
              gaussian_video: { type: 'string', format: 'uri', description: 'Gaussian splatting video' },
              radiance_video: { type: 'string', format: 'uri', description: 'Radiance field video' },
              mesh_video: { type: 'string', format: 'uri', description: 'Mesh construction video' },
              ply_url: { type: 'string', format: 'uri', description: 'Point cloud PLY file URL' },
              message: { type: 'string' },
            },
            required: ['status', 'request_id', 'glb_url', 'gaussian_video', 'radiance_video', 'mesh_video', 'ply_url'],
          },
          BatchItemResult: {
            type: 'object',
            properties: {
              index: { type: 'integer' },
              original_filename: { type: 'string' },
              status: { type: 'string', enum: ['success', 'failed'] },
              glb_url: { type: 'string', format: 'uri' },
              gaussian_video: { type: 'string', format: 'uri' },
              radiance_video: { type: 'string', format: 'uri' },
              mesh_video: { type: 'string', format: 'uri' },
              ply_url: { type: 'string', format: 'uri' },
              error_code: { type: 'string' },
              error: { type: 'string' },
              message: { type: 'string' },
            },
            required: ['index', 'status'],
          },
          BatchGenerationResponse: {
            type: 'object',
            properties: {
              total_count: { type: 'integer' },
              succeeded: { type: 'integer' },
              failed: { type: 'integer' },
              results: { type: 'array', items: { $ref: '#/components/schemas/BatchItemResult' } },
              message: { type: 'string' },
            },
            required: ['total_count', 'succeeded', 'failed', 'results'],
          },
          // Segmentation schemas
          Segment3DRequest: {
            type: 'object',
            properties: {
              file: { type: 'string', format: 'binary', description: 'GLB file to segment (required)' },
              prompt: { type: 'string', description: 'Optional hint for segmentation focus (e.g., "separate the wheels from the body")' },
              mode: { type: 'string', enum: ['auto', 'semantic'], default: 'auto', description: 'Segmentation mode' },
            },
            required: ['file'],
          },
          SegmentationServiceResponse: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              request_id: { type: 'string' },
              num_parts: { type: 'integer', description: 'Number of segmented parts' },
              segmented_glb_url: { type: 'string', format: 'uri', description: 'Segmented GLB file URL' },
              message: { type: 'string' },
            },
            required: ['status', 'request_id', 'num_parts', 'segmented_glb_url'],
          },
          // Smart Organize schemas
          SmartOrganizePart: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Part identifier' },
              name: { type: 'string', description: 'Descriptive name for the part' },
              group: { type: 'string', description: 'Group category' },
            },
            required: ['id', 'name', 'group'],
          },
          SmartOrganizeRequest: {
            type: 'object',
            properties: {
              parts: { type: 'string', description: 'JSON string of parts array [{id, color}]' },
              angles: { type: 'string', description: 'JSON string of angle labels' },
              original: { type: 'array', items: { type: 'string', format: 'binary' }, description: 'Original texture images' },
              colored: { type: 'array', items: { type: 'string', format: 'binary' }, description: 'Color-coded images' },
            },
            required: ['parts', 'original', 'colored'],
          },
          SmartOrganizeResponse: {
            type: 'object',
            properties: {
              parts: { type: 'array', items: { $ref: '#/components/schemas/SmartOrganizePart' } },
            },
            required: ['parts'],
          },
          // Error schemas
          ErrorResponse: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['error'] },
              error_code: { type: 'string' },
              message: { type: 'string' },
            },
            required: ['status', 'error_code', 'message'],
          },
        },
      },
      paths: {
        // Qwen endpoints
        '/qwen/text2img': {
          post: {
            tags: ['Qwen AI'],
            summary: 'Text to Image Generation',
            description: 'Generate images from text prompts using Qwen AI',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/QwenText2ImgRequest' },
                },
              },
            },
            responses: {
              '200': {
                description: 'Job submitted successfully',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/JobSubmitResponse' },
                  },
                },
              },
              '400': { description: 'Invalid request' },
              '500': { description: 'Server error' },
            },
          },
        },
        '/qwen/edit': {
          post: {
            tags: ['Qwen AI'],
            summary: 'Image Edit',
            description: 'Edit an image using AI. Returns job_id for async polling.',
            requestBody: {
              required: true,
              content: {
                'multipart/form-data': {
                  schema: {
                    type: 'object',
                    properties: {
                      image: { type: 'string', format: 'binary', description: 'Input image file' },
                      prompt: { type: 'string', description: 'Edit prompt', example: 'add a hat to the person' },
                      negative_prompt: { type: 'string', description: 'Negative prompt for classifier-free guidance' },
                      steps: { type: 'integer', default: 40, description: 'Inference steps (1–100)' },
                      cfg_scale: { type: 'number', default: 4.0, description: 'Guidance scale (0–20)' },
                      seed: { type: 'integer', default: 42, description: 'RNG seed (each sample uses independent seed)' },
                      num_samples: { type: 'integer', default: 1, description: 'Number of results (1–6)' },
                    },
                    required: ['image', 'prompt'],
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Job submitted successfully',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/JobSubmitResponse' },
                  },
                },
              },
            },
          },
        },
        '/qwen/edit-multi': {
          post: {
            tags: ['Qwen AI'],
            summary: 'Multi Image Edit',
            description: 'Edit multiple images with a single prompt. Returns job_id for async polling.',
            requestBody: {
              required: true,
              content: {
                'multipart/form-data': {
                  schema: {
                    type: 'object',
                    properties: {
                      files: { type: 'array', items: { type: 'string', format: 'binary' }, description: 'Multiple input image files' },
                      prompt: { type: 'string', description: 'Edit instruction', example: 'add shadow' },
                      steps: { type: 'integer', default: 40, description: 'Inference steps (1–100)' },
                      cfg_scale: { type: 'number', default: 4.0, description: 'Guidance scale (0–20)' },
                      seed: { type: 'integer', default: 42, description: 'RNG seed' },
                    },
                    required: ['files', 'prompt'],
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Job submitted successfully',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/JobSubmitResponse' },
                  },
                },
              },
            },
          },
        },
        '/qwen/angle': {
          post: {
            tags: ['Qwen AI'],
            summary: 'Generate Multi-Angle Views',
            description: 'Generate right, back, and left views from an input image. Returns job_id for async polling.',
            requestBody: {
              required: true,
              content: {
                'multipart/form-data': {
                  schema: {
                    type: 'object',
                    properties: {
                      image: { type: 'string', format: 'binary', description: 'Input image file' },
                      prompt: { type: 'string', description: 'Description for multi-angle generation', example: 'a red sports car' },
                      steps: { type: 'integer', default: 40, description: 'Inference steps (1–100)' },
                      cfg_scale: { type: 'number', default: 7.5, description: 'Guidance scale (0–20)' },
                      seed: { type: 'integer', description: 'RNG seed' },
                      num_samples: { type: 'integer', default: 1, description: 'Number of result sets (1–6)' },
                    },
                    required: ['image', 'prompt'],
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Job submitted successfully',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/JobSubmitResponse' },
                  },
                },
              },
            },
          },
        },
        '/qwen/download/{id}/{file_name}': {
          get: {
            tags: ['Qwen AI'],
            summary: 'Download Generated File',
            description: 'Download a generated image or video file by ID and filename',
            parameters: [
              {
                name: 'id',
                in: 'path',
                required: true,
                schema: { type: 'string' },
                description: 'Request ID',
              },
              {
                name: 'file_name',
                in: 'path',
                required: true,
                schema: { type: 'string' },
                description: 'File name',
              },
            ],
            responses: {
              '200': {
                description: 'File data',
                content: {
                  'application/octet-stream': {},
                  'image/*': {},
                  'video/mp4': {},
                },
              },
              '404': { description: 'File not found' },
            },
          },
        },
        '/qwen/angle/multi': {
          post: {
            tags: ['Qwen AI'],
            summary: 'Batch Multi-Angle Generation',
            description: 'Generate multi-angle views for multiple input images. Returns job_id for async polling.',
            requestBody: {
              required: true,
              content: {
                'multipart/form-data': {
                  schema: {
                    type: 'object',
                    properties: {
                      files: { type: 'array', items: { type: 'string', format: 'binary' }, description: 'Multiple input image files' },
                      prompt: { type: 'string', description: 'Description for multi-angle generation' },
                      steps: { type: 'integer', default: 40, description: 'Inference steps (1–100)' },
                      cfg_scale: { type: 'number', default: 7.5, description: 'Guidance scale (0–20)' },
                      seed: { type: 'integer', description: 'RNG seed' },
                    },
                    required: ['files', 'prompt'],
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Job submitted successfully',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/JobSubmitResponse' },
                  },
                },
              },
            },
          },
        },
        '/qwen/jobs/{job_id}': {
          get: {
            tags: ['Qwen AI'],
            summary: 'Get Qwen Job Status',
            description: 'Poll for job status and results',
            parameters: [
              {
                name: 'job_id',
                in: 'path',
                required: true,
                schema: { type: 'string' },
                description: 'Job ID',
              },
            ],
            responses: {
              '200': {
                description: 'Job status',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/JobStatusResponse' },
                  },
                },
              },
              '404': { description: 'Job not found' },
            },
          },
          delete: {
            tags: ['Qwen AI'],
            summary: 'Cancel Qwen Job',
            description: 'Cancel a queued job',
            parameters: [
              {
                name: 'job_id',
                in: 'path',
                required: true,
                schema: { type: 'string' },
                description: 'Job ID to cancel',
              },
            ],
            responses: {
              '200': { description: 'Job cancelled' },
              '404': { description: 'Job not found' },
              '409': { description: 'Cannot cancel (already processing or completed)' },
            },
          },
        },
        // ReconViaGen endpoints
        '/reconviagen/generate-single': {
          post: {
            tags: ['ReconViaGen'],
            summary: 'Generate 3D from Single Image',
            description: 'Generate 3D model (GLB, videos, PLY) from a single image',
            requestBody: {
              required: true,
              content: {
                'multipart/form-data': {
                  schema: { $ref: '#/components/schemas/ReconViaGenSingleRequest' },
                },
              },
            },
            responses: {
              '200': {
                description: 'Job submitted successfully',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/JobSubmitResponse' },
                  },
                },
              },
            },
          },
        },
        '/reconviagen/generate-multi': {
          post: {
            tags: ['ReconViaGen'],
            summary: 'Generate 3D from Multiple Images',
            description: 'Generate 3D model from multiple images',
            requestBody: {
              required: true,
              content: {
                'multipart/form-data': {
                  schema: { $ref: '#/components/schemas/ReconViaGenMultiRequest' },
                },
              },
            },
            responses: {
              '200': {
                description: 'Job submitted successfully',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/JobSubmitResponse' },
                  },
                },
              },
            },
          },
        },
        '/reconviagen/generate-batch': {
          post: {
            tags: ['ReconViaGen'],
            summary: 'Batch Generate 3D Models',
            description: 'Generate 3D models from multiple images in a ZIP file',
            requestBody: {
              required: true,
              content: {
                'multipart/form-data': {
                  schema: { $ref: '#/components/schemas/ReconViaGenBatchRequest' },
                },
              },
            },
            responses: {
              '200': {
                description: 'Job submitted successfully',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/JobSubmitResponse' },
                  },
                },
              },
            },
          },
        },
        '/reconviagen/jobs/{job_id}': {
          get: {
            tags: ['ReconViaGen'],
            summary: 'Get ReconViaGen Job Status',
            description: 'Poll for job status and results',
            parameters: [
              {
                name: 'job_id',
                in: 'path',
                required: true,
                schema: { type: 'string' },
                description: 'Job ID',
              },
            ],
            responses: {
              '200': {
                description: 'Job status',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/JobStatusResponse' },
                  },
                },
              },
              '404': { description: 'Job not found' },
            },
          },
          delete: {
            tags: ['ReconViaGen'],
            summary: 'Cancel ReconViaGen Job',
            description: 'Cancel a queued job',
            parameters: [
              {
                name: 'job_id',
                in: 'path',
                required: true,
                schema: { type: 'string' },
                description: 'Job ID to cancel',
              },
            ],
            responses: {
              '200': { description: 'Job cancelled' },
              '404': { description: 'Job not found' },
              '409': { description: 'Cannot cancel (already processing or completed)' },
            },
          },
        },
        '/reconviagen/download/{id}/{file_name}': {
          get: {
            tags: ['ReconViaGen'],
            summary: 'Download Generated File',
            description: 'Download a generated file by ID and filename',
            parameters: [
              {
                name: 'id',
                in: 'path',
                required: true,
                schema: { type: 'string' },
                description: 'File/request ID',
              },
              {
                name: 'file_name',
                in: 'path',
                required: true,
                schema: { type: 'string' },
                description: 'File name',
              },
            ],
            responses: {
              '200': {
                description: 'File data',
                content: {
                  'application/octet-stream': {},
                  'model/gltf-binary': {},
                },
              },
              '404': { description: 'File not found' },
            },
          },
        },
        // Segmentation endpoints
        '/segment/3d': {
          post: {
            tags: ['Segmentation'],
            summary: 'Segment 3D Model',
            description: 'Run SAM segmentation on a GLB file to separate parts. Returns job_id for async polling.',
            requestBody: {
              required: true,
              content: {
                'multipart/form-data': {
                  schema: {
                    type: 'object',
                    properties: {
                      file: { type: 'string', format: 'binary', description: 'GLB file to segment (required)' },
                      prompt: { type: 'string', description: 'Optional hint for segmentation focus (e.g., "separate the wheels from the body")' },
                      mode: { type: 'string', enum: ['auto', 'semantic'], default: 'auto', description: 'Segmentation mode' },
                    },
                    required: ['file'],
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Job submitted successfully',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/JobSubmitResponse' },
                  },
                },
              },
              '413': {
                description: 'File too large',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/ErrorResponse' },
                  },
                },
              },
              '500': { description: 'Service error' },
            },
          },
        },
        '/segment/3d/jobs/{job_id}': {
          get: {
            tags: ['Segmentation'],
            summary: 'Get Segmentation Job Status',
            description: 'Poll for segmentation job status',
            parameters: [
              {
                name: 'job_id',
                in: 'path',
                required: true,
                schema: { type: 'string' },
                description: 'Job ID',
              },
            ],
            responses: {
              '200': {
                description: 'Job status',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/JobStatusResponse' },
                  },
                },
              },
              '404': { description: 'Job not found' },
              '503': { description: 'Connection error' },
            },
            },
          delete: {
            tags: ['Segmentation'],
            summary: 'Cancel Segmentation Job',
            description: 'Cancel a queued segmentation job',
            parameters: [
              {
                name: 'job_id',
                in: 'path',
                required: true,
                schema: { type: 'string' },
                description: 'Job ID to cancel',
              },
            ],
            responses: {
              '200': { description: 'Job cancelled' },
              '404': { description: 'Job not found' },
              '503': { description: 'Connection error' },
            },
          },
        },
        // P3-SAM download
        '/p3sam/download/{request_id}/{file_name}': {
          get: {
            tags: ['Segmentation'],
            summary: 'Download Segmented File',
            description: 'Download a segmented GLB or PLY file from P3-SAM',
            parameters: [
              {
                name: 'request_id',
                in: 'path',
                required: true,
                schema: { type: 'string' },
                description: 'Request ID',
              },
              {
                name: 'file_name',
                in: 'path',
                required: true,
                schema: { type: 'string' },
                description: 'File name',
              },
            ],
            responses: {
              '200': {
                description: 'File data',
                content: {
                  'application/octet-stream': {},
                  'model/gltf-binary': {},
                },
              },
              '404': { description: 'File not found' },
            },
          },
        },
        // Smart Organize
        '/smart-organize': {
          post: {
            tags: ['Smart Organize'],
            summary: 'Smart Organize Parts',
            description: 'Use VLM (Vision Language Model) to intelligently name and group 3D model parts based on multi-angle screenshots',
            requestBody: {
              required: true,
              content: {
                'multipart/form-data': {
                  schema: { $ref: '#/components/schemas/SmartOrganizeRequest' },
                },
              },
            },
            responses: {
              '200': {
                description: 'Parts organized successfully',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/SmartOrganizeResponse' },
                  },
                },
              },
              '400': { description: 'Bad request - missing required fields' },
              '500': { description: 'VLM processing error' },
            },
          },
        },
      },
    },
  });
  return spec;
};
