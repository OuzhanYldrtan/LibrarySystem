import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import OpenAI from 'openai';
import { ChatDto } from './chat.dto.js';
import { McpClientService } from './mcp-client.service.js';
import { ChatScopeService } from './chat-scope.service.js';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/';
const DEFAULT_MODEL = 'gemini-3.5-flash-lite';

const SYSTEM_PROMPT = `Sen Raf Kütüphane çalışan asistanısın. Türkçe, kısa ve açık cevap ver.
Yalnızca kütüphane kataloğu, kitaplar, üyelerin ödünç kayıtları, raflar, müsaitlik ve iadeler hakkında cevap ver.
Selamlaşma, gündelik sohbet, genel kültür, haber, hava durumu, kodlama veya kütüphane dışındaki hiçbir konuda cevap verme.
Kapsam dışı bir istek ulaşırsa yalnızca "Yalnızca kütüphane sistemiyle ilgili sorulara cevap verebilirim." de.
Katalog, raf, müsaitlik, aktif ödünçler ve geciken kayıtlar için mutlaka sağlanan araçları kullan.
Sonuç yoksa bunu dürüstçe söyle; bilgi uydurma. Araç sonuçlarındaki tarihleri GG.AA.YYYY biçiminde açıkla.
TC kimlik numarası, doğum tarihi, adres, telefon veya e-posta isteme, tahmin etme ve paylaşma.
Kullanıcı hassas bilgi sorarsa bu verilerin chatbot erişimine kapalı olduğunu söyle.
Ödünç verme, iade veya üye oluşturma eylemi yapma; bunlar çalışan ekranından onaylı biçimde yapılır.`;

@Injectable()
export class ChatService {
  constructor(
    private readonly mcp: McpClientService,
    private readonly scope: ChatScopeService,
  ) {}

  status() {
    return {
      configured: Boolean(process.env.GEMINI_API_KEY),
      model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
      provider: 'Gemini',
      transport: 'mcp-stdio',
    };
  }

  async answer(dto: ChatDto) {
    const scope = await this.scope.classify(dto);
    if (scope === 'sensitive') {
      return {
        answer: 'TC kimlik, doğum tarihi, adres, telefon ve e-posta bilgileri chatbot erişimine kapalıdır.',
        toolsUsed: [],
        model: 'scope-filter',
      };
    }
    if (scope === 'out_of_scope') {
      return {
        answer: 'Yalnızca kütüphane sistemiyle ilgili sorulara cevap verebilirim.',
        toolsUsed: [],
        model: 'scope-filter',
      };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
    if (!apiKey) {
      throw new ServiceUnavailableException('LLM için GEMINI_API_KEY henüz yapılandırılmadı.');
    }

    const client = new OpenAI({ apiKey, baseURL: GEMINI_BASE_URL });
    const mcpTools = await this.mcp.listTools();
    const tools = mcpTools.map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema as Record<string, unknown>,
      },
    }));
    const history = (dto.history || []).slice(-8).map((item) => ({
      role: item.role,
      content: item.content,
    }));
    const messages: any[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history,
      { role: 'user', content: dto.message },
    ];
    const toolsUsed: string[] = [];

    for (let turn = 0; turn < 5; turn += 1) {
      const completion = await client.chat.completions.create({
        model,
        messages,
        tools,
        tool_choice: 'auto',
      } as any);
      const message = completion.choices[0]?.message;
      if (!message) {
        return { answer: 'Bu soruya bir yanıt oluşturamadım.', toolsUsed, model };
      }

      messages.push(message);
      const calls = message.tool_calls || [];
      if (!calls.length) {
        return {
          answer: message.content || 'Bu soruya bir yanıt oluşturamadım.',
          toolsUsed,
          model: completion.model || model,
        };
      }

      for (const call of calls) {
        if (call.type !== 'function') continue;
        toolsUsed.push(call.function.name);
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function.arguments || '{}');
        } catch {
          args = {};
        }
        const result = await this.mcp.callTool(call.function.name, args);
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
    }

    return { answer: 'Sorgu çok fazla adım gerektirdiği için durduruldu.', toolsUsed, model };
  }
}
