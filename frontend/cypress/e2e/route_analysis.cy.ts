/**
 * Sugestão de testes E2E com Cypress.
 *
 * Instalar: npm install -D cypress
 * Rodar:    npx cypress open
 *
 * Este arquivo é apenas documentação — não roda automaticamente.
 */

// cypress/e2e/route_analysis.cy.ts

describe('Weather Route Planner — Fluxo Principal', () => {

  beforeEach(() => {
    cy.visit('http://localhost:5173')
  })

  it('exibe a página inicial com mapa e painel de busca', () => {
    cy.contains('Weather Route Planner')
    // Painel de busca deve estar visível
    cy.get('[aria-label="🟢 Origem"]').should('be.visible')
    cy.get('[aria-label="🔴 Destino"]').should('be.visible')
  })

  it('busca rota entre São Paulo e Rio de Janeiro', () => {
    // Preenche origem
    cy.get('[aria-label="🟢 Origem"]').type('São Paulo')
    cy.get('[role="option"]').first().click()

    // Preenche destino
    cy.get('[aria-label="🔴 Destino"]').type('Rio de Janeiro')
    cy.get('[role="option"]').first().click()

    // Analisa
    cy.get('[aria-label="Analisar rota"]').click()

    // Aguarda resultado
    cy.contains('Analisando', { timeout: 5000 })
    cy.contains('km', { timeout: 60000 })

    // Timeline deve aparecer
    cy.get('[aria-label="Timeline de chuva"]').should('be.visible')
  })

  it('exibe erro quando backend está offline', () => {
    cy.intercept('POST', '/routes', { statusCode: 500 }).as('createRoute')

    cy.get('[aria-label="🟢 Origem"]').type('São Paulo')
    cy.get('[role="option"]').first().click()
    cy.get('[aria-label="🔴 Destino"]').type('Rio de Janeiro')
    cy.get('[role="option"]').first().click()
    cy.get('[aria-label="Analisar rota"]').click()

    cy.wait('@createRoute')
    cy.contains('Erro')
  })

  it('alterna entre modo claro e escuro', () => {
    // Clica no toggle de tema
    cy.get('[aria-label*="modo"]').click()
    cy.get('html').should('have.class', 'dark')

    cy.get('[aria-label*="modo"]').click()
    cy.get('html').should('not.have.class', 'dark')
  })
})
