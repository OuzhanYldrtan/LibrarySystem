import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { CreateMemberDto } from './create-member.dto.js';
import { isValidTcIdentity, maskTcIdentity } from './tc-identity.js';

@Injectable()
export class MembersService {
  constructor(private readonly db: DatabaseService) {}

  async list() {
    const result = await this.db.query(`SELECT m.id, m.full_name, m.tc_identity_no,
      m.birth_date, m.email, m.phone, m.address, m.created_at,
      COUNT(l.id) FILTER (WHERE l.returned_at IS NULL)::int AS active_loans
      FROM members m LEFT JOIN loans l ON l.member_id = m.id
      GROUP BY m.id ORDER BY m.created_at DESC, m.full_name`);
    return result.rows.map((member) => ({
      id: member.id, fullName: member.full_name, tcIdentityMasked: maskTcIdentity(member.tc_identity_no),
      birthDate: member.birth_date, email: member.email, phone: member.phone,
      address: member.address, createdAt: member.created_at, activeLoans: member.active_loans,
    }));
  }

  async create(dto: CreateMemberDto) {
    if (!isValidTcIdentity(dto.tcIdentityNo)) {
      throw new BadRequestException('TC kimlik numarası doğrulama kurallarını sağlamıyor.');
    }
    const birthDate = new Date(`${dto.birthDate}T12:00:00`);
    if (Number.isNaN(birthDate.getTime()) || birthDate >= new Date()) {
      throw new BadRequestException('Doğum tarihi geçmiş bir tarih olmalıdır.');
    }
    try {
      const result = await this.db.query(`INSERT INTO members
        (full_name, tc_identity_no, birth_date, email, phone, address)
        VALUES ($1, $2, $3, NULLIF($4, ''), NULLIF($5, ''), NULLIF($6, ''))
        RETURNING id, full_name, tc_identity_no, birth_date, email, phone, address, created_at`,
      [dto.fullName, dto.tcIdentityNo, dto.birthDate, dto.email || '', dto.phone || '', dto.address || '']);
      const member = result.rows[0];
      return {
        id: member.id, fullName: member.full_name,
        tcIdentityMasked: maskTcIdentity(member.tc_identity_no), birthDate: member.birth_date,
        email: member.email, phone: member.phone, address: member.address,
        createdAt: member.created_at, activeLoans: 0,
      };
    } catch (error: unknown) {
      if (typeof error === 'object' && error && 'code' in error && error.code === '23505') {
        throw new ConflictException('Bu TC kimlik numarası, e-posta veya ad ile kayıtlı bir üye zaten var.');
      }
      throw error;
    }
  }
}
